# Step 9: Conversation Compaction

Summarize older messages when serialized conversation history crosses a size
threshold, while keeping recent turns verbatim.

## What this step adds

- A `compaction` config object with threshold and recent-message settings
- Optional `AGENT_COMPACTION_CHARS` threshold override
- A hardcoded summarization prompt in `agent.ts`
- All config keys and approval behavior from earlier steps

The default threshold is 12,000 characters.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run:

```bash
deno task check
deno task start -- --verbose
```

Use a low threshold to demonstrate compaction quickly:

```bash
AGENT_COMPACTION_CHARS=100 deno task start -- --verbose
```

After enough turns, verbose output includes:

```text
=== COMPACTION START ===
Compacted 2 messages into:
...
=== COMPACTION END ===
```

The tested flow retained markers from both summarized and recent history. Press
Ctrl+C to stop.

## Next

`step-10-subagents` adds isolated delegated agent loops.
