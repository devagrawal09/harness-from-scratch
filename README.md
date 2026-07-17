# AI Agent Talk OpenRouter CLI

Tiny interactive TypeScript CLI that chats through OpenRouter.

## Setup

Create a `.env` file:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

## Run

```bash
deno task check
deno task start
```

Shell tool calls pause for human approval before they run. Add `--verbose` to show reasoning, tool calls, and tool results.
