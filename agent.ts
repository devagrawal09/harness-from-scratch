import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readdir } from "node:fs/promises";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter.ts";
import config from "./config.ts";

const skills = new Map<string, ParsedFrontmatter>();

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

  const parsed = parseFrontmatter(text, loc, dir);
  if (parsed) {
    skills.set(parsed.name.toLowerCase(), parsed);
  }
}

const mainMessages: any[] = [
  {
    role: "system",
    content: [
      "You are a concise, helpful coding assistant.",
      ...config.rules,
      `\n\nAvailable skills:\n${Array.from(skills.values())
        .map((skill) => `- ${skill.name}: ${skill.description}`)
        .join("\n")}`,
    ].filter(Boolean).join("\n\n"),
  },
];

const shellTool = {
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
};

const loadSkillTool = {
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
};

const runSubagentTool = {
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
};

const baseTools = [shellTool, loadSkillTool];
const mainTools = [shellTool, loadSkillTool, runSubagentTool];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

async function runAgent(
  agentName: string,
  agentMessages: any[],
  availableTools: any[],
): Promise<string> {
  const availableToolNames = new Set(
    availableTools.map((tool) => tool.function.name),
  );

  for (let i = 0; i < config.maxAgentIterations; i++) {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: agentMessages,
        tools: availableTools,
        reasoning: config.reasoning,
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

    if (reasoning && config.verbose) {
      const marker = `${agentName} reasoning`.toUpperCase();
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

      if (config.verbose) {
        const marker = `${agentName} tool call: ${name}`.toUpperCase();
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
          const proc = new Deno.Command("bash", { args: ["-lc", args.command] }).outputSync();
          result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
        }
        traceResult = `$ ${args.command}\n${result}`;
      }

      if (availableToolNames.has(name) && name === "load_skill") {
        const skill = skills.get(args.name.toLowerCase());
        result = skill ? skill.content : `Skill not found: ${args.name}`;
        traceResult = `Loaded skill: ${args.name}`;
      }

      if (availableToolNames.has(name) && name === "run_subagent") {
        const subagentMessages: any[] = [
          {
            role: "system",
            content: [
              "You are a focused coding subagent. Complete only the delegated task and return concise findings to the parent agent. You may use shell and skill tools, but you cannot delegate to another subagent or see the parent conversation.",
              ...config.rules,
              `\n\nAvailable skills:\n${Array.from(skills.values())
                .map((skill) => `- ${skill.name}: ${skill.description}`)
                .join("\n")}`,
            ].filter(Boolean).join("\n\n"),
          },
          { role: "user", content: args.task },
        ];

        result = await runAgent("subagent", subagentMessages, baseTools);
        if (config.verbose) {
          console.log(
            `\n=== SUBAGENT RESULT START ===\n${result || "(empty)"}\n=== SUBAGENT RESULT END ===\n`,
          );
        }
        traceResult = "Subagent completed.";
      }

      if (config.verbose) {
        const marker = `${agentName} tool result: ${name}`.toUpperCase();
        console.log(
          `\n=== ${marker} START ===\n${traceResult || "(empty)"}\n=== ${marker} END ===\n`,
        );
      }
      agentMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }

  return `Agent stopped after ${config.maxAgentIterations} iterations without a final response.`;
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  mainMessages.push({ role: "user", content: userMessage });
  const historyChars = JSON.stringify(mainMessages.slice(1)).length;
  if (historyChars > config.compaction.thresholdChars) {
    const targetStart = Math.max(
      1,
      mainMessages.length - config.compaction.recentMessageCount,
    );
    const recentStart = mainMessages.findIndex(
      (message, index) => index >= targetStart && message.role === "user",
    );

    if (recentStart > 1) {
      const olderMessages = mainMessages.slice(1, recentStart);
      const response = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
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

      if (config.verbose) {
        console.log(
          `\n=== COMPACTION START ===\nCompacted ${olderMessages.length} messages into:\n${summary}\n=== COMPACTION END ===\n`,
        );
      }
    }
  }

  const content = await runAgent("main", mainMessages, mainTools);
  if (config.verbose) {
    console.log(
      `\n=== TEXT OUTPUT START ===\n${content || "(empty)"}\n=== TEXT OUTPUT END ===\n`,
    );
  } else {
    console.log(content.replace(/\s+/g, " ").trim());
  }
}
