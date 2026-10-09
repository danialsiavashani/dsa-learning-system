import type { Lesson } from "../types";

const original = [
  { id: "a", value: 4 },
  { id: "b", value: 8 },
  { id: "c", value: 2 },
  { id: "d", value: 9 },
  { id: "e", value: 3 },
];

export const arraysLesson: Lesson = {
  id: "arrays",
  title: "Arrays",
  subtitle: "Watch how array state changes one step at a time.",

  steps: [
    {
      id: "array-1",
      title: "Arrays store values in ordered positions.",
      explanation:
        "Each value has an index that identifies its position.",
      visual: {
        type: "array",
        items: original,
      },
    },

    {
      id: "array-2",
      title: "Reading index 2 takes us directly to this value.",
      explanation:
        "The value at index 2 is 2.",
      visual: {
        type: "array",
        items: original,
        activeId: "c",
      },
    },

    {
  id: "array-3",
  title: "Now insert 7 at index 2.",
  explanation:
    "Before we reveal the result, predict what must move.",

  visual: {
    type: "array",
    items: original,
    activeId: "c",
  },

  prediction: {
    question: "Which existing values must shift to the right?",
    options: [
      {
        id: "a",
        label: "Only 2",
      },
      {
        id: "b",
        label: "2, 9, and 3",
      },
      {
        id: "c",
        label: "4 and 8",
      },
    ],
    correctOptionId: "b",
  },
},

    {
      id: "array-4",
      title: "The later values shift one position to the right.",
      explanation:
        "The existing values keep their identity, but their positions change.",
      visual: {
        type: "array",
        items: [
          { id: "a", value: 4 },
          { id: "b", value: 8 },
          { id: "new", value: 7 },
          { id: "c", value: 2 },
          { id: "d", value: 9 },
          { id: "e", value: 3 },
        ],
        activeId: "new",
      },
    },
  ],
};