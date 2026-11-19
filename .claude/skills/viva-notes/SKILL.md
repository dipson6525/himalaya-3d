---
name: viva-notes
description: How to write or refresh docs/viva/<member>.md after a feature lands, so each student can explain and defend their own modules in the KU viva. Use after any merged or ready-for-review feature, or when asked to update study notes.
---

# Viva notes (docs/viva/<member>.md)

Files: `unique-ghimire.md`, `sparsh-gorkhali.md`, `dipson-gurung.md`. Ownership is in `CLAUDE.md`.

## Required sections (keep this order)

1. **Your part in one paragraph** — what you built and why it matters to the app.
2. **File map** — table of every file you own: path → one-line purpose → related FR.
3. **Module walkthroughs** — for each module, in simple English: inputs → processing → outputs,
   the key functions (name + one line each), and *why this design* (alternatives considered).
4. **Key concepts from first principles** — short explanations with a small worked example using
   REAL numbers from our data (e.g. haversine Lukla→Namche using the coordinates in our GeoJSON).
   If the data does not exist yet, write the method and mark the numbers `TODO(team): fill after M2`.
   Never invent numbers.
5. **Likely viva questions (15–20) with model answers** — include "What would you improve?",
   "What was hardest?", "How did you test it?", "What did the AI tool do and how did you check it?".
6. **Prove you understand it** — 3–5 small changes the student must make BY HAND
   (e.g. "change the rest-day rule to every 3 days and update the tests"). Do NOT do these for them;
   do not include solutions.
7. **Changelog** — date + what was added to these notes.

## Style

- Plain English a second-year student can say out loud. Define every term on first use and add
  it to `docs/glossary.md`.
- Point to code by path and function name, not line numbers (they drift).
- Formulas in plain text or KaTeX-free Markdown (e.g. `a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)`).

## After writing

Run the `viva-examiner` subagent on the file and fix any question it says the notes cannot answer.
