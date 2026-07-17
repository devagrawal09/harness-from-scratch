# Repo Instructions

This is a tiny OpenRouter CLI agent demo. Keep changes small, readable, and dependency-free.

Skills are defined in the configured skills directory as `<skill-name>/SKILL.md` with frontmatter:

---
name: skill-name
description: When to use this skill.
---

At startup, skill names and descriptions are loaded into the system prompt.
Use `load_skill` to load the full skill content by frontmatter name (case-insensitive).
