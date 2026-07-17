import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";

const verbose = Bun.argv.includes("--verbose");
const model = "minimax/minimax-m3";
const maxAgentIterations = 50;
const configuredCompactionThreshold = Number(Bun.env.AGENT_COMPACTION_CHARS ?? 12_000);
const compactionThreshold = Number.isFinite(configuredCompactionThreshold) && configuredCompactionThreshold > 0
  ? configuredCompactionThreshold
  : 12_000;
const recentMessageCount = 4;
const agentsMd = await Bun.file("AGENTS.md").text();

const skills = new Map<string, {
  name: string;
  description: string;
  content: string;
  location: string;
  directory: string;
}>();

const skillBase = ".agents/skills";
const skillNames = await readdir(skillBase);

for (const name of skillNames) {
  const dir = `${skillBase}/${name}`;
  const loc = `${dir}/SKILL.md`;
  const file = Bun.file(loc);
  if (await file.exists()) {
    const text = await file.text();
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
}

const mainMessages: any[] = [
  {
    role: "system",
    content: [
      "You are a concise, helpful coding assistant.",
      agentsMd,
      `\n\nAvailable skills:\n${Array.from(skills.values())
        .map((skill) => `- ${skill.name}: ${skill.description}`)
        .join("\n")}`,
    ].filter(Boolean).join("\n\n"),
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
    const reasoning = [message.reasoning, message.reasoning_content]
      .filter((part) => typeof part === "string" && part.trim())
      .join("\n\n");
    agentMessages.push({
      ...message,
      reasoning: message.reasoning ?? message.reasoning_content ?? (reasoning || undefined),
    });

    if (reasoning && verbose) {
      const marker = (tracePrefix ? `${tracePrefix} reasoning` : "reasoning").toUpperCase();
      console.log(
        `\n=== ${marker} START ===\n${reasoning}\n=== ${marker} END ===\n`,
      );
    }

    if (!message.tool_calls) {
      return message.content || "";
    }

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result = `Tool not available: ${name}`;
      let traceResult = result;

      if (verbose) {
        const marker = (
          tracePrefix ? `${tracePrefix} tool call: ${name}` : `tool call: ${name}`
        ).toUpperCase();
        console.log(
          `\n=== ${marker} START ===\n${toolCall.function.arguments || "(empty)"}\n=== ${marker} END ===\n`,
        );
      }

      if (availableToolNames.has(name) && name === "shell") {
        const answer = (await rl.question(
          `\nApprove shell command? [y/N]\n$ ${args.command}\n> `,
        )).trim().toLowerCase();

        if (answer !== "y" && answer !== "yes") {
          result = "Shell command rejected by user.";
        } else {
          const proc = Bun.spawnSync(["bash", "-lc", args.command]);
          result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
        }
        traceResult = `$ ${args.command}\n${result}`;
      }

      if (availableToolNames.has(name) && name === "load_skill") {
        const skill = skills.get(args.name.toLowerCase());
        result = skill
          ? JSON.stringify({
              name: skill.name,
              content: skill.content,
              location: skill.location,
              directory: skill.directory,
            })
          : `Skill not found: ${args.name}`;
        traceResult = `Loaded skill: ${args.name}`;
      }

      if (availableToolNames.has(name) && name === "run_subagent") {
        const subagentMessages: any[] = [
          {
            role: "system",
            content: [
              "You are a focused coding subagent. Complete only the delegated task and return concise findings to the parent agent. You may use shell and skill tools, but you cannot delegate to another subagent or see the parent conversation.",
              agentsMd,
              `\n\nAvailable skills:\n${Array.from(skills.values())
                .map((skill) => `- ${skill.name}: ${skill.description}`)
                .join("\n")}`,
            ].filter(Boolean).join("\n\n"),
          },
          { role: "user", content: args.task },
        ];

        result = await runAgent(subagentMessages, baseTools, "subagent");
        if (verbose) {
          console.log(
            `\n=== SUBAGENT RESULT START ===\n${result || "(empty)"}\n=== SUBAGENT RESULT END ===\n`,
          );
        }
        traceResult = "Subagent completed.";
      }

      if (verbose) {
        const marker = (
          tracePrefix ? `${tracePrefix} tool result: ${name}` : `tool result: ${name}`
        ).toUpperCase();
        console.log(
          `\n=== ${marker} START ===\n${traceResult || "(empty)"}\n=== ${marker} END ===\n`,
        );
      }
      agentMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }

  return `Agent stopped after ${maxAgentIterations} iterations without a final response.`;
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  mainMessages.push({ role: "user", content: userMessage });
  const historyChars = JSON.stringify(mainMessages.slice(1)).length;
  if (historyChars > compactionThreshold) {
    const targetStart = Math.max(1, mainMessages.length - recentMessageCount);
    const recentStart = mainMessages.findIndex(
      (message, index) => index >= targetStart && message.role === "user",
    );

    if (recentStart > 1) {
      const olderMessages = mainMessages.slice(1, recentStart);
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
      mainMessages.splice(1, olderMessages.length, {
        role: "system",
        content: `Conversation summary:\n${summary}`,
      });

      if (verbose) {
        console.log(
          `\n=== COMPACTION START ===\nCompacted ${olderMessages.length} messages into:\n${summary}\n=== COMPACTION END ===\n`,
        );
      }
    }
  }

  const content = await runAgent(mainMessages, mainTools);
  if (verbose) {
    console.log(
      `\n=== TEXT OUTPUT START ===\n${content || "(empty)"}\n=== TEXT OUTPUT END ===\n`,
    );
  } else {
    console.log(content.replace(/\s+/g, " ").trim());
  }
}
