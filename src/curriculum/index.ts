import type { Lesson } from "@/lib/learning/schema";
import { arraysLesson } from "./lessons/arrays";
import { stackLesson } from "./lessons/stack";

export type Concept = {
  slug: string;
  label: string;
  lesson: Lesson;
};

/** The curriculum, in teaching order. Adding a concept = adding its lesson here. */
export const concepts: Concept[] = [
  { slug: "arrays", label: "Arrays", lesson: arraysLesson },
  { slug: "stack", label: "Stack", lesson: stackLesson },
];

export function findConcept(slug: string): Concept | undefined {
  return concepts.find((concept) => concept.slug === slug);
}
