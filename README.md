# AI Agent Talk OpenRouter CLI

Tiny interactive TypeScript CLI that chats through OpenRouter using Gemini 3 Flash.

## Setup

Create a `.env` file:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

If OpenRouter uses a different Gemini 3 Flash slug, override it:

```bash
export OPENROUTER_MODEL="google/gemini-3-flash"
```

## Run

```bash
deno task check
deno task start
```

Then type messages at the prompt. Use `/exit` to quit.
