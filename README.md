# Step 4.5: Native Tools

Replace the custom JSON action protocol with OpenRouter-compatible native tool
calling. Tool schemas stay hardcoded in `agent.ts`, not in config.

## What this step adds

- A native `shell` function tool
- Assistant tool-call messages and matching tool-result messages
- The same `apiKey`, `apiUrl`, and `model` config from prior steps

Shell commands still run without approval, and one tool round runs per user
input.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run:

```bash
deno task check
deno task start
```

Try:

```text
> Use the shell tool to run: printf STEP045_TOOL_OK
$ printf STEP045_TOOL_OK
STEP045_TOOL_OK
```

Press Ctrl+C to stop.

## Next

`step-05-agentic-loop` keeps calling the model after tool results until it
produces a final response.
