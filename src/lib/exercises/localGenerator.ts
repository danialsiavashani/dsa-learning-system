import { insertAt, itemsFromValues, valuesOf } from "@/lib/domain/array";
import type { Difficulty, ExerciseKindId } from "@/lib/learning/schema";
import {
  arrayInsertionKind,
  type ArrayInsertionCandidate,
} from "./kinds/arrayInsertion";
import { distinctInts, randomInt, type Random } from "./random";
import type { ExerciseGenerator, ExerciseRequest } from "./types";

/**
 * A local stand-in for an LLM provider. It invents fresh inputs within
 * pedagogically sensible bounds and emits a candidate in exactly the shape a
 * remote model would. Its output still goes through the full truth gate.
 */

type InsertionProfile = {
  length: [number, number];
  values: [number, number];
  /** Picks an insertion index for an array of the given length. */
  index: (random: Random, length: number) => number;
};

const insertionProfiles: Record<Difficulty, InsertionProfile> = {
  // Short arrays, an insertion point with values on both sides.
  intro: {
    length: [4, 5],
    values: [1, 9],
    index: (random, length) => randomInt(random, 1, length - 1),
  },
  // Longer arrays; the front is fair game.
  standard: {
    length: [5, 6],
    values: [1, 20],
    index: (random, length) => randomInt(random, 0, length - 1),
  },
  // Edge cases half the time: insert at the front or append at the end.
  challenge: {
    length: [5, 7],
    values: [-9, 30],
    index: (random, length) =>
      random() < 0.5
        ? (random() < 0.5 ? 0 : length)
        : randomInt(random, 0, length),
  },
};

function arrayInsertionCandidate(
  difficulty: Difficulty,
  random: Random,
): ArrayInsertionCandidate {
  const profile = insertionProfiles[difficulty];
  const length = randomInt(random, ...profile.length);
  const [value, ...initial] = distinctInts(random, length + 1, ...profile.values);
  const index = profile.index(random, length);

  // Like a model would, the generator states its own expectations. The
  // pipeline recomputes them independently and rejects any mismatch.
  const outcome = insertAt(itemsFromValues(initial), index, value, "new");
  return {
    kind: "array-insertion",
    concept: "arrays.insertion",
    difficulty,
    initial,
    operation: { type: "insert", index, value },
    expected: {
      result: valuesOf(outcome.after) as number[],
      shifted: valuesOf(outcome.shifted) as number[],
    },
  };
}

/** Each factory returns a candidate plus the fingerprint used to avoid repeats. */
type LocalFactory = (
  difficulty: Difficulty,
  random: Random,
) => { candidate: unknown; fingerprint: string };

const factories: Record<ExerciseKindId, LocalFactory> = {
  "array-insertion": (difficulty, random) => {
    const candidate = arrayInsertionCandidate(difficulty, random);
    return { candidate, fingerprint: arrayInsertionKind.fingerprint(candidate) };
  },
};

export function createLocalGenerator(random: Random = Math.random): ExerciseGenerator {
  return {
    name: "local",
    async generate(request: ExerciseRequest) {
      const create = factories[request.kind];
      const avoid = new Set(request.avoid ?? []);

      // Re-roll a few times so a repeat of an earlier example is unlikely.
      let draft = create(request.difficulty, random);
      for (let i = 0; i < 10 && avoid.has(draft.fingerprint); i++) {
        draft = create(request.difficulty, random);
      }
      return draft.candidate;
    },
  };
}
