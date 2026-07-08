import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices: Array<{
    message: {
      content: string;
      reasoning: string;
    };
  }>;
  error: {
    message?: string;
  };
};

const messages: OpenRouterMessage[] = [
  {
    role: "system",
    content: "You are a concise, helpful coding assistant.",
  },
];

const rl = createInterface({ input, output });

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: `minimax/minimax-m3`, messages }),
  });

  const body = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    throw new Error(
      `OpenRouter request failed: ${response.status} ${response.statusText}\n${body.error.message ?? JSON.stringify(body, null, 2)}`,
    );
  }
  const text = body.choices[0].message.content;

  messages.push({ role: "assistant", content: text });

  console.log(text);
}





