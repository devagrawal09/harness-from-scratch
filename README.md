# Step 3: System Prompt

Add a system message that defines the assistant as a concise coding helper.
The prompt is deliberately hardcoded in `agent.ts`; operational settings remain
in `config.ts`.

## What this step adds

- A system message at the beginning of conversation history
- Stable assistant behavior across turns
- The same `apiKey`, `apiUrl`, and `model` config from prior steps

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
> Reply with exactly STEP3_OK.
STEP3_OK
```

Press Ctrl+C to stop.

## Next

`step-04-json-actions` lets the model request a shell action through JSON.
