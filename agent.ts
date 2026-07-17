import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter.ts";
import config from "./config.ts";

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

const skills = new Map<string, ParsedFrontmatter>();

const skillBase = config.skillsDirectory;
const skillNames = await readdir(skillBase);

for (const name of skillNames) {
  const dir = `${skillBase}/${name}`;
  const loc = `${dir}/SKILL.md`;
  if (await fileExists(loc)) {
    const text = await Deno.readTextFile(loc);
    const parsed = parseFrontmatter(text, loc, dir);
    if (parsed) {
      skills.set(parsed.name.toLowerCase(), parsed);
    }
  }
}

const messages: any[] = [
  {
    role: "system",
    content: [
      "You are a concise, helpful coding assistant.",
      ...config.rules,
      `\n\nAvailable skills:\n${Array.from(skills.values())
        .map((s) => `- ${s.name}: ${s.description}`)
        .join("\n")}`,
    ].filter(Boolean).join("\n\n"),
  },
];

const tools = [
  {
    type: "function",
    function: {
      name: "shell",
      description: "Run a shell command in the current project.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "load_skill",
      description: "Load full skill content by frontmatter name (case-insensitive).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name from frontmatter" },
        },
        required: ["name"],
      },
    },
  },
];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

function printBlock(label: string, content: string) {
  if (!config.verbose) return;

  const marker = label.toUpperCase();
  console.log(`\n=== ${marker} START ===\n${content || "(empty)"}\n=== ${marker} END ===\n`);
}

function printTextOutput(content: string) {
  if (config.verbose) {
    printBlock("text output", content);
    return;
  }

  console.log(content.replace(/\s+/g, " ").trim());
}

function getReasoning(message: any) {
  return [message.reasoning, message.reasoning_content]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n\n");
}

function rememberAssistantMessage(message: any, reasoning: string) {
  messages.push({
    ...message,
    reasoning: message.reasoning ?? message.reasoning_content ?? (reasoning || undefined),
  });
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  for (let i = 0; i < config.maxAgentIterations; i++) {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        reasoning: config.reasoning,
      }),
    });

    const body = await response.json();
    const message = body.choices[0].message;
    const reasoning = getReasoning(message);
    rememberAssistantMessage(message, reasoning);

    if (reasoning) printBlock("reasoning", reasoning);

    if (!message.tool_calls) {
      printTextOutput(message.content);
      break;
    }

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result = "Unknown tool";

      printBlock(`tool call: ${toolCall.function.name}`, toolCall.function.arguments);

      if (toolCall.function.name === "shell") {
        const proc = new Deno.Command("bash", {
          args: ["-lc", args.command],
        }).outputSync();
        result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
        printBlock("tool result: shell", `$ ${args.command}\n${result}`);
      }

      if (toolCall.function.name === "load_skill") {
        const skill = skills.get(args.name.toLowerCase());
        result = skill ? skill.content : `Skill not found: ${args.name}`;
        printBlock("tool result: load_skill", `Loaded skill: ${args.name}`);
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
