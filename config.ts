export default {
  apiKey: Deno.env.get("OPENROUTER_API_KEY"),
  apiUrl: "https://openrouter.ai/api/v1/chat/completions",
  model: "minimax/minimax-m3",
};
