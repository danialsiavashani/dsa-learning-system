import Link from "next/link";
import type { Concept } from "@/curriculum";

type ConceptNavProps = {
  concepts: Pick<Concept, "slug" | "label">[];
  active: string;
};

const linkClass = (current: boolean) =>
  [
    "block rounded-lg px-3 py-1.5 transition",
    current ? "bg-ink text-canvas" : "text-muted hover:text-ink",
  ].join(" ");

/**
 * Switches between concepts: a segmented control on wider screens, and on
 * phones a single menu, so a growing curriculum never wraps into rows of tabs.
 */
export default function ConceptNav({ concepts, active }: ConceptNavProps) {
  const links = concepts.map((concept) => {
    const current = concept.slug === active;
    return (
      <li key={concept.slug}>
        <Link
          href={`/${concept.slug}`}
          aria-current={current ? "page" : undefined}
          className={linkClass(current)}
        >
          {concept.label}
        </Link>
      </li>
    );
  });
  const activeLabel = concepts.find((concept) => concept.slug === active)?.label;

  return (
    <nav aria-label="Concepts" className="w-full sm:w-auto">
      {/* Keyed by concept so it is closed again after navigating. */}
      <details key={active} className="group relative sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-muted">Concept: </span>
            {activeLabel}
          </span>
          <span aria-hidden className="text-muted transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <ul className="absolute inset-x-0 z-10 mt-1 flex flex-col gap-0.5 rounded-xl border border-line bg-panel p-1 text-sm font-semibold shadow-lg">
          {links}
        </ul>
      </details>

      <ul className="hidden flex-wrap rounded-xl border border-line bg-panel p-1 text-sm font-semibold sm:flex">
        {links}
      </ul>
    </nav>
  );
}
