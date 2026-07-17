# Step 5: Agentic Loop

Continue calling the model after each tool result until it returns a final text
response or reaches the configured iteration limit.

## What this step adds

- A model → tool → model loop
- `maxAgentIterations` in config
- The prior `apiKey`, `apiUrl`, and `model` config keys

The shell tool remains hardcoded in `agent.ts` and still runs without approval.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run:

```bash
deno task check
deno task start
```

Try:

```text
> Use the shell tool to run printf STEP5_LOOP_OK, then reply with exactly DONE.
$ printf STEP5_LOOP_OK
STEP5_LOOP_OK
DONE
```

Press Ctrl+C to stop.

## Next

`step-06-rules-and-skills` adds repository rules and on-demand skills.
