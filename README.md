# DSA Learning System

An interactive **Java** DSA + LeetCode tutor: **show → trace → predict → explain → complete → solve**.
Handcrafted lessons and generated examples run through the same validation, rendering and grading engine.

The web app is Next.js + TypeScript, but every learner-facing code example is Java. The schema enforces this: a `CodeView` can only have `language: "java"`.

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

- **A visualizer** (stack, tree, …): add a variant to `visualStateSchema`, then a component in `components/visualizers/registry.ts`.
- **An exercise kind**: add its id to `EXERCISE_KINDS`, write a definition (schema, `verify`, `compile`) in `lib/exercises/kinds/`, and register it in `lib/exercises/registry.ts`.
- **An LLM provider**: implement `ExerciseGenerator` (its output is treated as `unknown`) and swap it in at `lib/exercises/index.ts`. Rejection reasons are passed back on retries through `GenerationContext.previousProblems`.
