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

  it("sizes the panel from the stage, not the browser viewport", () => {
    // 1280×720 stage is CSS-scaled. vw tracks the window, so the editor
    // looked a different width than the widened max-w-6xl layout.
    assert.match(panel, /w-\[96%\] max-w-6xl/);
    assert.doesNotMatch(panel, /96vw/);
  });

  it("keeps header chrome shrink-0 and body min-h-0 flex-1", () => {
    assert.match(panel, /shrink-0 items-center justify-between/);
    assert.match(panel, /flex min-h-0 flex-1 flex-col overflow-hidden/);
    // Three-column cards tab: left art/bust rail + list + form
    assert.match(panel, /flex w-\[32%\] min-h-0 min-w-0 flex-col/);
    assert.match(panel, /stage-scroll flex w-\[12\.5rem\] shrink-0 flex-col/);
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

  it("composites art with CardFace and keeps bust as plain /cards image", () => {
    assert.match(panel, /function DraftArtPreview/);
    assert.match(panel, /<CardFace[\s\S]*?size="lg"/);
    assert.match(panel, /DraftArtPreview draft=\{draft\}/);
    // Bust must remain a plain img preview (no CardFace)
    assert.match(panel, /label="bust"/);
    assert.match(panel, /cardArtPath\(draft\.bust/);
    const bustBlock = panel.slice(panel.indexOf('label="bust"'));
    assert.doesNotMatch(bustBlock.slice(0, 400), /CardFace/);
  });
});
