# Step 7: Reasoning Output

Request model reasoning and make terminal traces optional with `--verbose`.

## What this step adds

- `reasoning` and `verbose` config keys
- Reasoning preservation in assistant history
- Verbose blocks for reasoning, tool calls, tool results, and final text
- All config keys from earlier steps

Tool definitions and system prompts remain hardcoded in `agent.ts`.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run normally:

```bash
deno task check
deno task start
```

Run with traces:

```bash
deno task start -- --verbose
```

Try:

```text
> Reply with exactly STEP7_OK without using tools.
=== REASONING START ===
...
=== TEXT OUTPUT START ===
STEP7_OK
=== TEXT OUTPUT END ===
```

Without `--verbose`, final text is printed compactly. Press Ctrl+C to stop.

## Next

`step-08-approvals-hitl` puts a human approval gate in front of shell commands.
