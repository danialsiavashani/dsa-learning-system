import type { ArrayItem } from "@/curriculum/types";

type AnimatedArrayProps = {
  items: ArrayItem[];
  activeId?: string;
};

const CELL_SIZE = 64;
const GAP = 12;

export default function AnimatedArray({
  items,
  activeId,
}: AnimatedArrayProps) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div
        className="relative"
        style={{
          width: items.length * (CELL_SIZE + GAP),
          height: 90,
        }}
      >
        {items.map((item, index) => {
          const active = item.id === activeId;

          return (
            <div
              key={item.id}
              className={[
                "absolute top-0 flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2",
                "transition-all duration-500 ease-in-out",
                active
                  ? "scale-110 border-[#2B6CE0] bg-[#E3ECFC]"
                  : "border-[#C9D4E2] bg-[#F9FBFD]",
              ].join(" ")}
              style={{
                left: index * (CELL_SIZE + GAP),
              }}
            >
              <span className="text-xl font-bold">
                {item.value}
              </span>

              <span className="mt-1 text-xs text-[#5B6B80]">
                {index}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}