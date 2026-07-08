import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";

interface Skill {
  name: string;
  description: string;
  content: string;
  location: string;
  directory: string;
}

function parseFrontmatter(text: string, location: string, directory: string): Skill | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const raw = text.slice(4, end);
  const rest = text.slice(end + 5);
  let name = "";
  let description = "";
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 2).trim();
    if (key === "name") name = val;
    if (key === "description") description = val;
  }
  if (!name) return null;
  return { name, description, content: rest, location, directory };
}

const agentsMd = await Bun.file("AGENTS.md").text();

const skills = new Map<string, Skill>();

const skillBase = ".agents/skills";
let skillNames: string[] = [];
try {
  skillNames = await readdir(skillBase);
} catch {
  // no skills directory
}
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
      skills.size > 0
        ? `\n\nAvailable skills:\n${Array.from(skills.values())
            .map((s) => `- ${s.name}: ${s.description}`)
            .join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n"),
  },
];

const tools: any[] = [
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
];

if (skills.size > 0) {
  tools.push({
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
  });
}

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
