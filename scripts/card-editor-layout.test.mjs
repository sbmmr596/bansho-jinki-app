import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("card editor panel layout (stage scroll)", () => {
  const panel = readFileSync(
    join(root, "src/components/game/CardEditorPanel.tsx"),
    "utf8",
  );
  const css = readFileSync(join(root, "src/styles.css"), "utf8");

  it("caps panel height and allows flex children to shrink", () => {
    assert.match(panel, /max-h-\[92%\]/);
    assert.match(panel, /panel flex max-h-\[92%\] min-h-0/);
    assert.match(panel, /overflow-hidden rounded-xl/);
  });

  it("keeps header chrome shrink-0 and body min-h-0 flex-1", () => {
    assert.match(panel, /shrink-0 items-center justify-between/);
    assert.match(panel, /flex min-h-0 flex-1 flex-col overflow-hidden/);
    assert.match(panel, /flex w-\[38%\] min-h-0 min-w-0 flex-col/);
  });

  it("uses stage-scroll on list and form bodies", () => {
    assert.match(css, /\.stage-scroll\s*\{/);
    assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
    assert.match(css, /touch-action:\s*pan-y/);
    const scrollUses = panel.split("stage-scroll").length - 1;
    assert.ok(scrollUses >= 3, `expected >=3 stage-scroll regions, got ${scrollUses}`);
  });

  it("keeps primary save actions in a sticky footer bar", () => {
    assert.match(panel, /border-t border-white\/10 pt-2/);
    assert.match(panel, /このカードを保存/);
    assert.match(panel, /陣営名を保存/);
    // Save must not sit only inside the form scroll region after the art fields
    const footerIdx = panel.indexOf("border-t border-white/10 pt-2");
    const saveIdx = panel.indexOf("このカードを保存");
    assert.ok(footerIdx > 0 && saveIdx > footerIdx);
  });
});
