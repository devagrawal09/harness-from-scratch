# Step 10: Subagents

Add a `run_subagent` tool that starts an isolated model/tool loop for a focused
delegated task.

## What this step adds

- A hardcoded `run_subagent` tool in `agent.ts`
- Separate parent and subagent tool lists
- Isolated subagent message history
- Parent-visible subagent results and verbose traces
- Every config key from Step 9; tools and system prompts remain outside config

Subagents receive configured rules plus shell and skill tools. They cannot see
the parent conversation or delegate to another subagent.

## Setup and run

Create `.env`:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

Then run:

```bash
deno task check
deno task start -- --verbose
```

Try:

```text
> Delegate to a subagent: ask it to return exactly SUBAGENT_OK. Then reply with exactly PARENT_OK.
=== SUBAGENT RESULT START ===
SUBAGENT_OK
=== SUBAGENT RESULT END ===
=== TEXT OUTPUT START ===
PARENT_OK
=== TEXT OUTPUT END ===
```

Compaction and shell approvals continue to work as in prior steps. Press Ctrl+C
to stop.
