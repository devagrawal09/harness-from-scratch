# Step 8: Human Approval

Pause before every shell command and let the user approve or reject it.

## What this step adds

- A `[y/N]` approval prompt for shell tool calls
- Rejected tool results returned to the model
- The complete config contract from Step 7, with no new config key required

The shell and approval logic remain hardcoded in `agent.ts`.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run:

```bash
deno task check
deno task start -- --verbose
```

Try requesting a harmless command and reject it:

```text
> Use the shell tool to run printf SHOULD_NOT_RUN.
Approve shell command? [y/N]
$ printf SHOULD_NOT_RUN
> n
Shell command rejected by user.
```

The model receives the rejection and continues without executing the command.
Press Ctrl+C to stop.

## Next

`step-09-compaction` summarizes older history when the conversation grows.
