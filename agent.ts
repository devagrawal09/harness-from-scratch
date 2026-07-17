import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import config from "./config.ts";

const messages = [];

const rl = createInterface({ input, output });

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
    }),
  });

  const body: any = await response.json();
  const text = body.choices[0].message.content;

  messages.push({ role: "assistant", content: text });
  console.log(text);
}
