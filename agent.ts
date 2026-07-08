import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter";

const agentsMd = await Bun.file("AGENTS.md").text();

const skills = new Map<string, ParsedFrontmatter>();

const skillBase = ".agents/skills";
const skillNames = await readdir(skillBase)

for (const name of skillNames) {
  const dir = `${skillBase}/${name}`;
  const loc = `${dir}/SKILL.md`;
  const file = Bun.file(loc);
  if (await file.exists()) {
    const text = await file.text();
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
        .join("\n")}`
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
  }
];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

function shell(command: string) {
  const proc = Bun.spawnSync(["bash", "-lc", command]);
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

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  for (let i = 0; i < 5; i++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "minimax/minimax-m3",
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
        result = shell(args.command);
        console.log(`$ ${args.command}\n${result}`);
      }

      if (toolCall.function.name === "load_skill") {
        result = loadSkill(args.name);
        console.log(`Loaded skill: ${args.name}`);
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
