import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import config from "./config.ts";

const messages: any[] = [
  { role: "system", content: "You are a concise, helpful coding assistant." },
];

const tools = [
  {
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
  },
];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  for (let i = 0; i < config.maxAgentIterations; i++) {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
      }),
    });

    const body = await response.json();
    const message = body.choices[0].message;
    messages.push(message);

    if (!message.tool_calls) {
      console.log(message.content);
      break;
    }

    for (const toolCall of message.tool_calls) {
      const { command } = JSON.parse(toolCall.function.arguments);
      const proc = new Deno.Command("bash", { args: ["-lc", command] }).outputSync();
      const result = (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
      console.log(`$ ${command}\n${result}`);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
    }
  }
}
