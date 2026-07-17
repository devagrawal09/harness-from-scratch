# Step 1: One-shot Chat

This checkpoint replaces the echo with a single OpenRouter Chat Completions
request. Each line entered in the CLI is sent to `minimax/minimax-m3` as an
independent user message.

## What changed

- `config.ts` holds the OpenRouter URL, API key, and model name.
- `agent.ts` sends one HTTP request for each terminal input.
- The assistant's text response is printed to the terminal.

This is a chatbot, not an agent: it has no conversation memory and cannot take
actions.

## Setup

```bash
export OPENROUTER_API_KEY="sk-or-your-key"
```

## Run

```bash
deno task check
deno task start
```

Press Ctrl+C to quit.

## Try it

Send these as two separate messages:

```text
> Remember the codeword ORCHID.
> What codeword did I give you?
```

The second request contains only the second message, so the model cannot
reliably know the codeword. That missing state is the next concept.

## Limitations

- No conversation history or system instructions
- No tools or agent loop
- No HTTP or response-shape error handling

## Next

`step-02-message-history` keeps prior user and assistant messages in memory and
resends them with every request.
