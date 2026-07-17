# AI Agent Talk OpenRouter CLI

Tiny interactive TypeScript CLI that chats through OpenRouter.

## Setup

```bash
bun install
export OPENROUTER_API_KEY="sk-or-your-key"
```

## Run

```bash
bun run agent.ts
```

Shell tool calls pause for human approval before they run. Add `--verbose` to show reasoning, tool calls, and tool results.

Conversation history compacts automatically after 12,000 serialized characters while recent turns remain verbatim. Set `AGENT_COMPACTION_CHARS` to a lower threshold when demonstrating compaction.

The `run_subagent` tool delegates self-contained tasks to isolated model calls. Subagents receive the repository instructions, but not the parent conversation or tools.
