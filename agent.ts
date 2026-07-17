import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import config from "./config.ts";

const skills = new Map<string, {
  name: string;
  description: string;
  content: string;
  location: string;
  directory: string;
}>();

const skillBase = config.skillsDirectory;
const skillNames = await readdir(skillBase);

for (const name of skillNames) {
  const dir = `${skillBase}/${name}`;
  const loc = `${dir}/SKILL.md`;
  let text;
  try {
    text = await Deno.readTextFile(loc);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) continue;
    throw error;
  }
  if (!text.startsWith("---\n")) continue;

  const end = text.indexOf("\n---\n", 4);
  if (end === -1) continue;

  let skillName = "";
  let description = "";
  for (const line of text.slice(4, end).split("\n")) {
    const separator = line.indexOf(": ");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 2).trim();
    if (key === "name") skillName = value;
    if (key === "description") description = value;
  }

  if (skillName) {
    skills.set(skillName.toLowerCase(), {
      name: skillName,
      description,
      content: text.slice(end + 5),
      location: loc,
      directory: dir,
    });
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
      }),
    });

    const body = await response.json();
    const message = body.choices[0].message;
    messages.push(message);

    if (!message.tool_calls) {
      console.log(message.content);
      break;
    }

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let result = "Unknown tool";

      if (toolCall.function.name === "shell") {
        const proc = new Deno.Command("bash", {
          args: ["-lc", args.command],
        }).outputSync();
        result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
        console.log(`$ ${args.command}\n${result}`);
      }

      if (toolCall.function.name === "load_skill") {
        const skill = skills.get(args.name.toLowerCase());
        result = skill ? skill.content : `Skill not found: ${args.name}`;
        console.log(`Loaded skill: ${args.name}`);
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
