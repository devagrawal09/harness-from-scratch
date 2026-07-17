# Step 4: JSON Actions

Teach the model to return either a normal reply or a shell request as JSON.
`agent.ts` parses that JSON and executes requested shell commands.

## What this step adds

- A hardcoded JSON action protocol in the system prompt
- `reply` and `shell` actions
- Shell execution with output added to message history
- The same `apiKey`, `apiUrl`, and `model` config from prior steps

This checkpoint trusts model-produced shell commands and does not ask for
approval. Use it only in a disposable project.

## Setup and run

Create `.env` with `OPENROUTER_API_KEY`, then run:

```bash
deno task check
deno task start
```

Try:

```text
> Use the shell action to run: printf STEP4_TOOL_OK
$ printf STEP4_TOOL_OK
STEP4_TOOL_OK
```

One model action runs per user input; there is not yet an agent loop. Press
Ctrl+C to stop.

## Next

`step-04.5-native-tools` replaces the custom JSON protocol with native tool
calling.
