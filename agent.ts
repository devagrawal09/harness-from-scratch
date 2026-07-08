import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";

interface Skill {
  name: string;
  description: string;
  content: string;
}

function parseFrontmatter(text: string): { name: string; description: string; content: string } | null {
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
  return { name, description, content: rest };
}

const agentsFile = Bun.file("AGENTS.md");
const agentsInstructions = (await agentsFile.exists()) ? await agentsFile.text() : "";

const skills = new Map<string, Skill>();
try {
  const files = await readdir("skills");
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const text = await Bun.file(`skills/${file}`).text();
    const parsed = parseFrontmatter(text);
    if (parsed) {
      skills.set(parsed.name.toLowerCase(), parsed);
    }
  }
} catch {}

const skillsList = Array.from(skills.values())
  .map((s) => `- ${s.name}: ${s.description}`)
  .join("\n");
const skillsSection = skillsList ? `\n\nAvailable skills:\n${skillsList}` : "";

const messages: any[] = [
  {
    role: "system",
    content: ["You are a concise, helpful coding assistant.", agentsInstructions, skillsSection].filter(Boolean).join("\n\n"),
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
      description: "Load full skill content by frontmatter name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name from frontmatter (case-insensitive)" },
        },
        required: ["name"],
      },
    },
  },
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
  return skill.content;
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
