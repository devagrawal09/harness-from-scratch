# Step 6: Rules and Skills

Load repository rules into the system message and expose skill summaries to the
model. Full skill instructions are loaded on demand with `load_skill`.

## What this step adds

- `rules`, populated from `AGENTS.md`, in config
- A configurable `skillsDirectory`
- Skill discovery from `<skillsDirectory>/<skill>/SKILL.md`
- A hardcoded `load_skill` tool in `agent.ts`
- All config keys from earlier steps

Skill names come from frontmatter and are matched case-insensitively.

## Setup and run

Create `.env`:

```dotenv
OPENROUTER_API_KEY="sk-or-your-key"
```

Then run:

```bash
deno task check
deno task start
```

Try loading a skill listed by the startup system prompt:

```text
> Load the typescript-check skill, then reply with exactly SKILL_OK.
Loaded skill: typescript-check
SKILL_OK
```

Press Ctrl+C to stop.

## Next

`step-07-reasoning-output` exposes reasoning and detailed traces in verbose
mode.
