# Step 1: One-shot Chat

Replace the echo with an OpenRouter Chat Completions request. Every input is an
independent request to `minimax/minimax-m3`.

## What this step adds

- `config.ts` with `apiKey`, `apiUrl`, and `model`
- One model request per terminal input
- Assistant text output

This is still a chatbot, not an agent: it has no memory or tools.

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
> Reply with exactly STEP1_OK.
STEP1_OK
```

To observe the missing memory, give the model a codeword and ask for it in the
next input. The second request does not contain the first one. Press Ctrl+C to
stop.

## Next

`step-02-message-history` resends prior user and assistant messages.
