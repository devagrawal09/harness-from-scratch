import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter.ts";

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

const verbose = Deno.args.includes("--verbose");
const model = "minimax/minimax-m3";
const configuredCompactionThreshold = Number(Deno.env.get("AGENT_COMPACTION_CHARS") ?? 12_000);
const compactionThreshold = Number.isFinite(configuredCompactionThreshold) && configuredCompactionThreshold > 0
  ? configuredCompactionThreshold
  : 12_000;
const recentMessageCount = 4;
const agentsMd = await Deno.readTextFile("AGENTS.md");

const skills = new Map<string, ParsedFrontmatter>();

const skillBase = ".agents/skills";
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
      agentsMd,
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
      description: "Request human approval, then run a shell command in the current project.",
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

async function shell(command: string) {
  const answer = (await rl.question(`\nApprove shell command? [y/N]\n$ ${command}\n> `))
    .trim()
    .toLowerCase();

  if (answer !== "y" && answer !== "yes") {
    return "Shell command rejected by user.";
  }

  const proc = new Deno.Command("bash", { args: ["-lc", command] }).outputSync();
  return (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
}

function loadSkill(name: string) {
  const skill = skills.get(name.toLowerCase());
  if (!skill) return `Skill not found: ${name}`;
  return JSON.stringify({
    name: skill.name,
    content: skill.content,
    location: skill.location,
    directory: skill.directory,
  });
}

function printBlock(label: string, content: string) {
  if (!verbose) return;

  const marker = label.toUpperCase();
  console.log(`\n=== ${marker} START ===\n${content || "(empty)"}\n=== ${marker} END ===\n`);
}

function printTextOutput(content: string) {
  if (verbose) {
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

async function compactHistory() {
  const historyChars = JSON.stringify(messages.slice(1)).length;
  if (historyChars <= compactionThreshold) return;

  const targetStart = Math.max(1, messages.length - recentMessageCount);
  const recentStart = messages.findIndex(
    (message, index) => index >= targetStart && message.role === "user",
  );
  if (recentStart <= 1) return;

  const olderMessages = messages.slice(1, recentStart);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Summarize this conversation history for another coding agent. Preserve requirements, decisions, file names, exact identifiers, and unfinished work. Do not add new information.",
        },
        { role: "user", content: JSON.stringify(olderMessages) },
      ],
    }),
  });

  const body = await response.json();
  const summary = body.choices[0].message.content;
  messages.splice(1, olderMessages.length, {
    role: "system",
    content: `Conversation summary:\n${summary}`,
  });
  printBlock("compaction", `Compacted ${olderMessages.length} messages into:\n${summary}`);
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });
  await compactHistory();

  for (let i = 0; i < 50; i++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        reasoning: { effort: "medium" },
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
        result = await shell(args.command);
        printBlock("tool result: shell", `$ ${args.command}\n${result}`);
      }

      if (toolCall.function.name === "load_skill") {
        result = loadSkill(args.name);
        printBlock("tool result: load_skill", `Loaded skill: ${args.name}`);
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
