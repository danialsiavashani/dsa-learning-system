/** Renders lesson text, turning `backticked` spans into inline code. */
export default function RichText({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, index) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
      <code
        key={index}
        className="rounded bg-accent-soft px-1 py-0.5 font-mono text-[0.9em] text-ink"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
