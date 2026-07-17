# Step 0: Echo CLI

This checkpoint builds the terminal interface before introducing a model. It
reads one line at a time and prints the same text back.

## What this teaches

- A chat-style CLI is just an input/output loop.
- The interface can be tested independently from the model.
- Nothing in this step is an agent yet.

## Run

```bash
deno task check
deno task start
```

Type a few messages at the prompt. Press Ctrl+C to quit.

## Try it

```text
> hello agent
hello agent
```

The response is deterministic because no network request, model, message
history, or tool is involved.

## Next

`step-01-chat-cli` replaces the echo with a single OpenRouter model call.
