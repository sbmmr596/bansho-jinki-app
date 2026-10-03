import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("card editor Drive plan B (local + JSON export)", () => {
  const panel = readFileSync(
    join(root, "src/components/game/CardEditorPanel.tsx"),
    "utf8",
  );
  const catalog = readFileSync(
    join(root, "src/components/game/CatalogPanel.tsx"),
    "utf8",
  );
  const download = readFileSync(join(root, "src/game/catalog-download.ts"), "utf8");
  const drive = readFileSync(join(root, "src/game/drive-catalog.ts"), "utf8");
  const exportMod = readFileSync(join(root, "src/game/drive-export.ts"), "utf8");

  it("opens without Google sign-in gate", () => {
    assert.doesNotMatch(panel, /SignInButtons/);
    assert.doesNotMatch(panel, /resolveSignInGateState/);
    assert.doesNotMatch(panel, /gateState === "signed_out"/);
    // The signed-in user only mirrors saves to the account; it never gates the editor.
    assert.doesNotMatch(panel, /isPending\s*\?/);
    assert.match(panel, /if \(user\) void saveUserCatalog/);
    assert.match(panel, /このカードを保存/);
    assert.match(panel, /JSONを書き出す/);
  });

  it("CatalogPanel offers カード編集を開く without user ?", () => {
    assert.match(catalog, /カード編集を開く/);
    // Must not wrap the open button in user ?
    const openIdx = catalog.indexOf("カード編集を開く");
    const before = catalog.slice(Math.max(0, openIdx - 280), openIdx);
    assert.doesNotMatch(before, /\{user \?/);
  });

  it("persists via applyCatalog + localStorage CATALOG_KEY", () => {
    assert.match(panel, /applyCatalog/);
    assert.match(panel, /localStorage\.setItem\(CATALOG_KEY/);
    assert.match(panel, /exportCatalogPayload/);
  });

  it("downloads chars.json via exportCatalogPayload helper", () => {
    assert.match(download, /CATALOG_DOWNLOAD_FILENAME = "chars\.json"/);
    assert.match(download, /exportCatalogPayload/);
    assert.match(download, /JSON\.stringify\(exportCatalogPayload\(\), null, 2\)/);
    assert.match(download, /a\.download = filename/);
    assert.match(panel, /downloadCatalogJson/);
  });

  it("JSONを書き出す tries Drive first and falls back to a local download", () => {
    assert.match(panel, /exportWithFallback\(/);
    assert.match(panel, /saveDrive: \(\) => saveDriveCatalog/);
    assert.match(panel, /download: \(\) => downloadCatalogJson\(\)/);
    assert.match(exportMod, /deps\.saveDrive\(\)/);
    assert.match(exportMod, /deps\.download\(\)/);
    assert.match(exportMod, /端末にダウンロードした/);
    // the export button must never send the user to the generic gate sign-in
    assert.doesNotMatch(panel, /redirectForDriveLogin/);
    assert.doesNotMatch(panel, /decideDriveLogin/);
  });

  it("always offers a plain local ダウンロード button", () => {
    assert.match(panel, /onClick=\{onDownloadJson\}/);
    assert.match(panel, /const onDownloadJson = \(\) =>/);
    const btn = panel.slice(panel.indexOf("onClick={onDownloadJson}"));
    assert.match(btn, /ダウンロード/);
    assert.doesNotMatch(
      panel.slice(panel.indexOf("const onDownloadJson"), panel.indexOf("onClick={onDownloadJson}")),
      /saveDriveCatalog\(/,
    );
  });

  it("explains Drive export, the local fallback and 万象陣記", () => {
    assert.match(panel, /万象陣記/);
    assert.match(panel, /書けなければ端末にダウンロード/);
    assert.match(panel, /「ダウンロード」は端末へ直接保存/);
  });

  it("Drive folder/file names remain 万象陣記 / chars.json", () => {
    assert.match(drive, /DRIVE_FOLDER = "万象陣記"/);
    assert.match(drive, /chars\.json/);
  });

  it("exposes a values-free driveDiag server function", () => {
    assert.match(drive, /export const driveDiag = createServerFn\(\{ method: "POST" \}\)/);
    assert.match(catalog, /接続の診断/);
  });

  it("keeps the save / export / download toolbar above the scrolling body (#93)", () => {
    const scrollUses = panel.split("stage-scroll").length - 1;
    assert.ok(scrollUses >= 3, `expected >=3 stage-scroll, got ${scrollUses}`);
    const toolbarIdx = panel.indexOf("ml-auto flex min-w-0 flex-wrap");
    const saveIdx = panel.lastIndexOf("このカードを保存");
    const exportIdx = panel.lastIndexOf("JSONを書き出す");
    const downloadIdx = panel.lastIndexOf("ダウンロード\n");
    const bodyIdx = panel.indexOf("flex min-h-0 flex-1 flex-col overflow-hidden");
    assert.ok(toolbarIdx > 0 && saveIdx > toolbarIdx);
    assert.ok(exportIdx > saveIdx && downloadIdx > exportIdx && bodyIdx > downloadIdx);
  });
});
