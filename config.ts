const configuredCompactionThreshold = Number(
  Deno.env.get("AGENT_COMPACTION_CHARS") ?? 12_000,
);
const compactionThreshold = Number.isFinite(configuredCompactionThreshold) &&
    configuredCompactionThreshold > 0
  ? configuredCompactionThreshold
  : 12_000;

export default {
  apiKey: Deno.env.get("OPENROUTER_API_KEY"),
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  model: "minimax/minimax-m3",
  maxAgentIterations: 50,
  rules: [await Deno.readTextFile("AGENTS.md")],
  skillsDirectory: ".agents/skills",
  verbose: Deno.args.includes("--verbose"),
  reasoning: { effort: "medium" },
  compaction: {
    thresholdChars: compactionThreshold,
    recentMessageCount: 4,
  },
};
