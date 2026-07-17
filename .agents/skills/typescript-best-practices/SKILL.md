---
name: typescript-best-practices
description: Use when writing or reviewing TypeScript code for correctness, maintainability, and idiomatic Deno/TypeScript practices.
---

# TypeScript Best Practices

Use this skill when writing new TypeScript code or reviewing existing TypeScript code.

1. Prefer clear, boring TypeScript over clever abstractions.
2. Use precise types at boundaries; let local implementation details infer naturally.
3. Keep async behavior explicit and handle awaited results deliberately.
4. Avoid unrequested framework, dependency, config, or generic helper ceremony.
5. For Deno projects, use the repo's existing scripts and runtime conventions.
6. When reviewing code, check correctness first, then readability, type safety, and maintainability.
7. Before claiming code works, run `deno task check`.
8. If tests exist and the change touches behavior, run the relevant tests too.
9. If a check fails, summarize the first actionable error and fix that before continuing.
