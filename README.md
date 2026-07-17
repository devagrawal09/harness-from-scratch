# Step 2: Message History

Keep prior user and assistant messages in memory and send the complete history
with every OpenRouter request.

## What this step adds

- A persistent `messages` array for the current process
- Multi-turn conversational memory
- The same `apiKey`, `apiUrl`, and `model` config introduced in Step 1

History is not saved to disk; restarting the CLI starts a new conversation.

## Setup

Create `.env`:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

## Run

```bash
deno task check
deno task start
```

Try:

```text
> Remember codeword ZEBRA. Reply only READY.
READY
> What codeword did I give you? Reply with only it.
ZEBRA
```

Press Ctrl+C to stop.

## Next

`step-03-system-prompt` adds a hardcoded system instruction.
