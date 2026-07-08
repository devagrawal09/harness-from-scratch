import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const messages = [
  {
    role: "system",
    content:
      'You are a concise coding assistant. Respond only with JSON: {"action":"reply","content":"..."} or {"action":"shell","command":"..."}. Use shell when you need to inspect the local project.',
  },
];

const rl = createInterface({ input, output });
const decoder = new TextDecoder();

function shell(command: string) {
  const proc = Bun.spawnSync(["bash", "-lc", command]);
  return (decoder.decode(proc.stdout) + decoder.decode(proc.stderr)).trim();
}

console.log(`Hi, how can I help you today?`);

while (true) {
  const userMessage = (await rl.question("> ")).trim();

  messages.push({ role: "user", content: userMessage });

  for (let i = 0; i < 5; i++) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Bun.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "minimax/minimax-m3",
        messages,
      }),
    });

    const body = await response.json();
    const text = body.choices[0].message.content;
    const action = JSON.parse(text);

    messages.push({ role: "assistant", content: text });

    if (action.action === "reply") {
      console.log(action.content);
      break;
    }

    const result = shell(action.command);
    console.log(`$ ${action.command}
${result}`);
    messages.push({ role: "user", content: `Shell output:
${result}` });
  }
}
