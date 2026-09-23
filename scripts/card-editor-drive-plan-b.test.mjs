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

  it("opens without Google sign-in gate", () => {
    assert.doesNotMatch(panel, /SignInButtons/);
    assert.doesNotMatch(panel, /resolveSignInGateState/);
    assert.doesNotMatch(panel, /gateState === "signed_out"/);
    assert.doesNotMatch(panel, /useCurrentUserState/);
    assert.doesNotMatch(panel, /saveUserCatalog/);
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

  it("mentions Drive reload via マイデータ ドライブから読む", () => {
    assert.match(panel, /ドライブから読む/);
    assert.match(panel, /万象陣記/);
  });

  it("Drive folder/file names remain 万象陣記 / chars.json", () => {
    assert.match(drive, /DRIVE_FOLDER = "万象陣記"/);
    assert.match(drive, /chars\.json/);
  });

  it("keeps sticky save footer and stage-scroll (#93)", () => {
    assert.match(panel, /border-t border-white\/10 pt-2/);
    const scrollUses = panel.split("stage-scroll").length - 1;
    assert.ok(scrollUses >= 3, `expected >=3 stage-scroll, got ${scrollUses}`);
    const footerIdx = panel.indexOf("border-t border-white/10 pt-2");
    const saveIdx = panel.lastIndexOf("このカードを保存");
    const exportIdx = panel.lastIndexOf("JSONを書き出す");
    assert.ok(footerIdx > 0 && saveIdx > footerIdx && exportIdx > footerIdx);
  });
});
