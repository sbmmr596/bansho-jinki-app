/** Small marks for solo strongholds. Path cells stay plain circles. */

const common = "h-[58%] w-[58%]";

export function HomeMark() {
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden>
      <path fill="currentColor" d="M3 11.2 12 3.5l9 7.7V21H3V11.2Z" />
      <path fill="currentColor" fillOpacity="0.35" d="M10 21v-6h4v6H10Z" />
    </svg>
  );
}

const PATHS: Record<string, string> = {
  関: "M4 20V8h4v4h8V8h4v12H4Zm6-8h4v8h-4v-8Z",
  砦: "M3 9h3V5h3v4h2V5h3v4h2V5h3v4h2v12H3V9Z",
  塔: "M10 3h4v3h2v15H8V6h2V3Zm2 8h-1v3h1v-3Z",
  社: "M2 10h20v2H2v-2Zm3 2h2v8H5v-8Zm12 0h2v8h-2v-8ZM4 8l8-5 8 5H4Z",
  陣: "M5 21V4h2v7h4V7h2v14h-2v-6H7v6H5Z",
  城: "M3 10h3V6h3v4h2V6h2v4h2V6h3v4h3v11H3V10Z",
  港: "M11 3h2v6h4a5 5 0 1 1-10 0h4V3ZM4 18h16v2H4v-2Z",
  嶺: "M2 19 9 6l3 5 2-3 8 11H2Z",
  丘: "M2 18c3-6 6-8 10-8s7 2 10 8H2Z",
  原: "M3 16h18v2H3v-2Zm1-4h16v2H4v-2Zm2-4h12v2H6V8Z",
};

export function HoldMark({ kind }: { kind: string }) {
  const d = PATHS[kind] ?? PATHS["陣"];
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden>
      <path fill="currentColor" d={d} />
    </svg>
  );
}
