const configuredCompactionThreshold = Number(
  Deno.env.get("AGENT_COMPACTION_CHARS") ?? 12_000,
);
const compactionThreshold = Number.isFinite(configuredCompactionThreshold) &&
    configuredCompactionThreshold > 0
  ? configuredCompactionThreshold
  : 12_000;

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

export default {
  apiKey: Deno.env.get("OPENROUTER_API_KEY"),
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  model: "minimax/minimax-m3",
  systemPrompt: "You are a concise, helpful coding assistant.",
  subagentSystemPrompt:
    "You are a focused coding subagent. Complete only the delegated task and return concise findings to the parent agent. You may use shell and skill tools, but you cannot delegate to another subagent or see the parent conversation.",
  maxAgentIterations: 50,
  agentInstructionsFile: "AGENTS.md",
  skillsDirectory: ".agents/skills",
  verbose: Deno.args.includes("--verbose"),
  reasoning: { effort: "medium" },
  compaction: {
    thresholdChars: compactionThreshold,
    recentMessageCount: 4,
    systemPrompt:
      "Summarize this conversation history for another coding agent. Preserve requirements, decisions, file names, exact identifiers, and unfinished work. Do not add new information.",
  },
  tools: {
    base: [shellTool, loadSkillTool],
    main: [shellTool, loadSkillTool, runSubagentTool],
  },
};
