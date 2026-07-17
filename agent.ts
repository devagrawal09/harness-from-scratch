import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import config from "./config.ts";

const messages: any[] = [
  { role: "system", content: "You are a concise, helpful coding assistant." },
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
      tools: config.tools,
    }),
  });

  const body = await response.json();
  const message = body.choices[0].message;
  messages.push(message);

  if (!message.tool_calls) {
    console.log(message.content);
  } else {
    for (const toolCall of message.tool_calls) {
      const { command } = JSON.parse(toolCall.function.arguments);
      const proc = new Deno.Command("bash", { args: ["-lc", command] }).outputSync();
      const result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
      console.log(`$ ${command}\n${result}`);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
