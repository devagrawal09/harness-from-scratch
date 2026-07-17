const shellTool = {
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
};

export default {
  apiKey: Deno.env.get("OPENROUTER_API_KEY"),
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  model: "minimax/minimax-m3",
  tools: [shellTool],
};
