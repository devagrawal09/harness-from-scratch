# AI Agent Talk OpenRouter CLI

Tiny interactive TypeScript CLI that chats through OpenRouter.

## Setup

Create a `.env` file:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

## Run

```bash
deno task start
```

Shell tool calls pause for human approval before they run. Add `--verbose` to show reasoning, tool calls, and tool results.

Conversation history compacts automatically after 12,000 serialized characters while recent turns remain verbatim. Set `AGENT_COMPACTION_CHARS` to a lower threshold when demonstrating compaction.

The `run_subagent` tool starts the same model/tool loop with isolated message history. Subagents receive the repository instructions plus shell and skill tools, but not the parent conversation or the ability to delegate again.
