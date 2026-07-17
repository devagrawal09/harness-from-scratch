import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import config from "./config.ts";

const rl = createInterface({ input, output });

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: userMessage }]
    }),
  });

  const text = (await response.json()).choices[0].message.content;

  console.log(text);
}
