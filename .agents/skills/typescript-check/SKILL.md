---
name: typescript-check
description: Use when validating a TypeScript/Deno project before claiming code works.
---

# TypeScript Check

1. Run `deno task check`.
2. If that passes, run `deno test` only if tests exist.
3. If either command fails, summarize the first error and stop.
4. If everything passes, say exactly what passed.
