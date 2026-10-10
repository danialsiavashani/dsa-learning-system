import type { PracticeRequest } from "@/lib/learning/schema";

export type PracticeControls = {
  onRequest: (request: PracticeRequest) => void;
  pending: boolean;
  error: string | null;
};

type AnotherExampleProps = {
  request: PracticeRequest;
  controls: PracticeControls;
};

export default function AnotherExample({ request, controls }: AnotherExampleProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => controls.onRequest(request)}
        disabled={controls.pending}
        className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-ink disabled:cursor-wait disabled:opacity-50"
      >
        {controls.pending ? "Generating…" : "Another example"}
      </button>
      <span className="text-sm text-muted">Same idea, freshly generated.</span>
      {controls.error && (
        <p role="alert" className="basis-full text-sm text-miss">
          {controls.error}
        </p>
      )}
    </div>
  );
}
