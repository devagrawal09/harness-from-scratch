---
name: typescript-check
description: Use when validating a TypeScript/Bun project before claiming code works.
---

# TypeScript Check

1. Run `bun run check`.
2. If that passes, run `bun test` only if a test script exists.
3. If either command fails, summarize the first error and stop.
4. If everything passes, say exactly what passed.
