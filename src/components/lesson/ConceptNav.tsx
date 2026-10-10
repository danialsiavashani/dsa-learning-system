import Link from "next/link";
import type { Concept } from "@/curriculum";

type ConceptNavProps = {
  concepts: Pick<Concept, "slug" | "label">[];
  active: string;
};

/** A small segmented switcher between concepts; it grows with the curriculum. */
export default function ConceptNav({ concepts, active }: ConceptNavProps) {
  return (
    <nav aria-label="Concepts">
      <ul className="flex flex-wrap rounded-xl border border-line bg-panel p-1 text-sm font-semibold">
        {concepts.map((concept) => {
          const current = concept.slug === active;
          return (
            <li key={concept.slug}>
              <Link
                href={`/${concept.slug}`}
                aria-current={current ? "page" : undefined}
                className={[
                  "block rounded-lg px-3 py-1.5 transition",
                  current ? "bg-ink text-canvas" : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {concept.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
