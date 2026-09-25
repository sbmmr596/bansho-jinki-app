import { useState } from "react";
import { CloseButton } from "./pieces";

const TRIALS = [
  { id: "kaien", name: "カイエン" },
  { id: "azuha", name: "アズハ" },
  { id: "claire", name: "クレア" },
  { id: "gouzan", name: "ゴウザン" },
] as const;

export function ArtTrialOverlay({ onClose }: { onClose: () => void }) {
  const [artStyle, setArtStyle] = useState<"sd" | "line">("sd");

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#f4efe6] px-4 py-2 text-[#1a1612]">
      <div className="mb-1 flex shrink-0 items-center gap-3">
        <p className="font-display text-lg tracking-wide">イラスト試作</p>
        <div className="flex overflow-hidden rounded-sm border border-[#c9bfb0] text-xs">
          <button
            type="button"
            onClick={() => setArtStyle("sd")}
            className={
              artStyle === "sd" ? "bg-[#1a1612] px-3 py-1 text-[#f4efe6]" : "px-3 py-1"
            }
          >
            D 5.5頭身
          </button>
          <button
            type="button"
            onClick={() => setArtStyle("line")}
            className={
              artStyle === "line" ? "bg-[#1a1612] px-3 py-1 text-[#f4efe6]" : "px-3 py-1"
            }
          >
            L 長身
          </button>
        </div>
        <p className="text-[15px] text-[#6e6558]">左からカイエン・アズハ・クレア・ゴウザン</p>
        <CloseButton onClick={onClose} className="ml-auto" />
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        {TRIALS.map((t) => (
          <figure key={t.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden rounded-sm bg-white">
              <img
                src={`/samples/art/${t.id}-${artStyle}.jpg`}
                alt={t.name}
                className="h-full w-full object-contain"
              />
            </div>
            <figcaption className="shrink-0 pt-1 text-center text-sm">{t.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
