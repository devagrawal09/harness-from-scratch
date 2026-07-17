import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import config from "./config.ts";

const messages = [
  {
    role: "system",
    content:
      'You are a concise coding assistant. Respond only with JSON: {"action":"reply","content":"..."} or {"action":"shell","command":"..."}. Use shell when you need to inspect the local project or run terminal commands on the local machine.',
  },
];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

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

  const body = await response.json();
  const text = body.choices[0].message.content;
  const action = JSON.parse(text);

  messages.push({ role: "assistant", content: text });

  if (action.action === "reply") {
    console.log(action.content);
  } else {
    const proc = new Deno.Command("bash", {
      args: ["-lc", action.command],
    }).outputSync();
    const result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
    console.log(`$ ${action.command}\n${result}`);
    messages.push({ role: "user", content: `Shell output:\n${result}` });
  }
}
