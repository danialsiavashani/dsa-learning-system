# DSA Learning System

An interactive **Java** DSA + LeetCode tutor: **show → trace → predict → explain → complete → solve**.
Handcrafted lessons and generated examples run through the same validation, rendering and grading engine.

The web app is Next.js + TypeScript, but every learner-facing code example is Java. The schema enforces this: a `CodeView` can only have `language: "java"`.

## Curriculum sources

Canonical lessons are grounded in vetted sources and paraphrased, never copied:

- **OpenDSA** for concepts, sequencing and pedagogy.
- **Princeton Algorithms, 4th Edition (algs4)** and the **Java SE API docs** as the Java implementation check.

Each lesson lists the pages it draws on in its `sources` metadata (title, URL, role: concept, implementation or pedagogy). Claims in a lesson must be supported by those sources or by the deterministic domain logic.

## Scripts

```bash
npm run dev         # http://localhost:3000
npm test            # unit tests (Vitest, pure logic)
npm run typecheck   # next typegen + tsc
npm run lint
npm run build
```

## Architecture

```
curriculum data / generator output            (plain structured data, untrusted if generated)
        ↓
lib/learning/schema.ts                        Zod schema: steps, questions, visual states, code
        ↓
lib/exercises/pipeline.ts  acceptCandidate    kind → schema → domain verification → compile → lesson schema
        ↓
components/lesson/LessonRunner                navigation, prediction gating, replay, code panel
        ↓
components/visualizers/registry               one visualizer per visual-state kind
```

- `src/lib/domain/` holds pure algorithm truth (for example `insertAt`). Visuals, validators and answer keys are all derived from it.
- `src/lib/learning/` holds the step model (a union discriminated by `mode`), deterministic grading (`checkAnswer`), and the session reducer.
- `src/lib/exercises/` holds the generator boundary (`ExerciseGenerator`), the exercise kinds, the local generator and the truth gate.
- `src/curriculum/` holds handcrafted lessons and shared concept material such as code snippets.

### Adding things

- **A concept**: write its lesson in `src/curriculum/lessons/` and add it to `src/curriculum/index.ts`. It gets a route (`/arrays`, `/stack`, `/recursion`, `/trees`, …) and appears in the concept switcher.

- **A visualizer** (queue, tree, …): add a variant to `visualStateSchema`, then a component in `components/visualizers/registry.ts`.
- **An exercise kind**: add its id to `EXERCISE_KINDS` and its skills to `EXERCISE_SKILLS`, write a definition (schema, `verify`, `compile`) in `lib/exercises/kinds/`, and register it in `lib/exercises/registry.ts`.
- **An LLM provider**: implement `ExerciseGenerator` (its output is treated as `unknown`) and swap it in at `lib/exercises/index.ts`. Rejection reasons are passed back on retries through `GenerationContext.previousProblems`.
