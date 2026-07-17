import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter";

const verbose = Bun.argv.includes("--verbose");
const model = "minimax/minimax-m3";
const maxAgentIterations = 50;
const configuredCompactionThreshold = Number(Bun.env.AGENT_COMPACTION_CHARS ?? 12_000);
const compactionThreshold = Number.isFinite(configuredCompactionThreshold) && configuredCompactionThreshold > 0
  ? configuredCompactionThreshold
  : 12_000;
const recentMessageCount = 4;
const agentsMd = await Bun.file("AGENTS.md").text();

const skills = new Map<string, ParsedFrontmatter>();

const skillBase = ".agents/skills";
const skillNames = await readdir(skillBase);

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

function buildSystemPrompt(instruction: string) {
  return [
    instruction,
    agentsMd,
    `\n\nAvailable skills:\n${Array.from(skills.values())
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join("\n")}`,
  ].filter(Boolean).join("\n\n");
}

const mainMessages: any[] = [
  {
    role: "system",
    content: buildSystemPrompt("You are a concise, helpful coding assistant."),
  },
];

const baseTools = [
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

const mainTools = [
  ...baseTools,
  {
    type: "function",
    function: {
      name: "run_subagent",
      description:
        "Delegate a focused task to an isolated agent loop with shell and skill tools. Include all needed context because it cannot see this conversation.",
      parameters: {
        type: "object",
        properties: {
          task: { type: "string", description: "Self-contained task for the subagent" },
        },
        required: ["task"],
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

function rememberAssistantMessage(agentMessages: any[], message: any, reasoning: string) {
  agentMessages.push({
    ...message,
    reasoning: message.reasoning ?? message.reasoning_content ?? (reasoning || undefined),
  });
}

function traceLabel(prefix: string, label: string) {
  return prefix ? `${prefix} ${label}` : label;
}

async function runAgent(
  agentMessages: any[],
  availableTools: any[],
  tracePrefix = "",
): Promise<string> {
  const availableToolNames = new Set(
    availableTools.map((tool) => tool.function.name),
  );

  for (let i = 0; i < maxAgentIterations; i++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: agentMessages,
        tools: availableTools,
        reasoning: { effort: "medium" },
      }),
    });

    const body = await response.json();
    const message = body.choices[0].message;
    const reasoning = getReasoning(message);
    rememberAssistantMessage(agentMessages, message, reasoning);

    if (reasoning) printBlock(traceLabel(tracePrefix, "reasoning"), reasoning);

    if (!message.tool_calls) {
      return message.content || "";
    }

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result = `Tool not available: ${name}`;
      let traceResult = result;

      printBlock(traceLabel(tracePrefix, `tool call: ${name}`), toolCall.function.arguments);

      if (availableToolNames.has(name) && name === "shell") {
        result = await shell(args.command);
        traceResult = `$ ${args.command}\n${result}`;
      }

      if (availableToolNames.has(name) && name === "load_skill") {
        result = loadSkill(args.name);
        traceResult = `Loaded skill: ${args.name}`;
      }

      if (availableToolNames.has(name) && name === "run_subagent") {
        result = await runSubagent(args.task);
        traceResult = "Subagent completed.";
      }

      printBlock(traceLabel(tracePrefix, `tool result: ${name}`), traceResult);
      agentMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }

  return `Agent stopped after ${maxAgentIterations} iterations without a final response.`;
}

async function runSubagent(task: string) {
  const subagentMessages: any[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        "You are a focused coding subagent. Complete only the delegated task and return concise findings to the parent agent. You may use shell and skill tools, but you cannot delegate to another subagent or see the parent conversation.",
      ),
    },
    { role: "user", content: task },
  ];

  const content = await runAgent(subagentMessages, baseTools, "subagent");
  printBlock("subagent result", content);
  return content;
}

async function compactHistory(agentMessages: any[]) {
  const historyChars = JSON.stringify(agentMessages.slice(1)).length;
  if (historyChars <= compactionThreshold) return;

  const targetStart = Math.max(1, agentMessages.length - recentMessageCount);
  const recentStart = agentMessages.findIndex(
    (message, index) => index >= targetStart && message.role === "user",
  );
  if (recentStart <= 1) return;

  const olderMessages = agentMessages.slice(1, recentStart);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
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
  agentMessages.splice(1, olderMessages.length, {
    role: "system",
    content: `Conversation summary:\n${summary}`,
  });
  printBlock("compaction", `Compacted ${olderMessages.length} messages into:\n${summary}`);
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  mainMessages.push({ role: "user", content: userMessage });
  await compactHistory(mainMessages);

  const content = await runAgent(mainMessages, mainTools);
  printTextOutput(content);
}
