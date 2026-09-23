import { exportCatalogPayload } from "@/game/data";

/** Drive workflow B: upload target under 万象陣記/ */
export const CATALOG_DOWNLOAD_FILENAME = "chars.json";

/** Pretty JSON for Drive upload — same shape as exportCatalogPayload. */
export function catalogDownloadText(): string {
  return `${JSON.stringify(exportCatalogPayload(), null, 2)}\n`;
}

/** Browser download of the in-memory catalog as chars.json. */
export function downloadCatalogJson(filename = CATALOG_DOWNLOAD_FILENAME): void {
  const text = catalogDownloadText();
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
