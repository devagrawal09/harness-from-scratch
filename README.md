# Step 0: Echo CLI

Build the terminal interface before introducing a model. The program reads one
line at a time and echoes it back.

## What this step adds

- An asynchronous terminal input loop
- A visible prompt and deterministic output
- No configuration, network access, model, memory, or tools

## Run

```bash
deno task check
deno task start
```

Try:

```text
> echo-smoke
echo-smoke
```

Press Ctrl+C to stop the loop.

## Next

`step-01-chat-cli` replaces the echo with an OpenRouter model call.
