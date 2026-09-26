import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { applyCatalog } from "@/game/data";
import { loadUserCatalog } from "@/game/catalog-api";
import { loadDriveCatalog } from "@/game/drive-catalog";
import { driveResumePending } from "@/game/drive-resume";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ArtTrialOverlay } from "./ArtTrialOverlay";
import { BattleView } from "./BattleView";
import { CatalogPanel } from "./CatalogPanel";
import { CardEditorPanel } from "./CardEditorPanel";
import { CollectionScreen } from "./CollectionScreen";
import { DebugPanel } from "./DebugPanel";
import { FormationScreen } from "./FormationScreen";
import { HelpOverlay } from "./HelpOverlay";
import { MapScreen } from "./MapScreen";
import { PalaceScreen } from "./PalaceScreen";
import { ResultScreen } from "./ResultScreen";
import { ScoutScreen } from "./ScoutScreen";
import { SummonScreen } from "./SummonScreen";
import { TitleScreen } from "./TitleScreen";
import { TrainScreen } from "./TrainScreen";
import { ArenaScreen } from "./ArenaScreen";
import { ArtZoom } from "./pieces";
import { DESIGN_H, DESIGN_W, isPinchZoom, stageFrame } from "@/game/design";

/** Show portrait tip when contain-scale is this small (phone portrait). */
const PORTRAIT_TIP_SCALE = 0.55;

export function GameApp() {
  const hydrate = useGame((s) => s.hydrate);
  const hydrated = useGame((s) => s.hydrated);
  const screen = useGame((s) => s.screen);
  const helpOpen = useGame((s) => s.helpOpen);
  const persist = useGame((s) => s.persist);
  const debugOpen = useGame((s) => s.debugOpen);
  const catalogOpen = useGame((s) => s.catalogOpen);
  const cardEditorOpen = useGame((s) => s.cardEditorOpen);
  const setCardEditorOpen = useGame((s) => s.setCardEditorOpen);
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const { user, isPending: authPending } = useCurrentUserState();
  const [artOpen, setArtOpen] = useState(false);
  const [driveTried, setDriveTried] = useState(false);
  const [showLandscapeHint, setShowLandscapeHint] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !driveResumePending()) return;
    setCatalogOpen(true);
  }, [hydrated, setCatalogOpen]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void loadDriveCatalog()
      .then((result) => {
        if (cancelled || !result.ok || result.status !== "loaded") return;
        const n = applyCatalog(JSON.parse(result.payload) as unknown);
        if (n) setCatalogSource("drive");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDriveTried(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, setCatalogSource]);

  useEffect(() => {
    if (!hydrated || !driveTried || authPending || !user) return;
    const src = useGame.getState().catalogSource;
    if (src === "drive") return;
    let cancelled = false;
    void loadUserCatalog()
      .then((remote) => {
        if (cancelled || !remote) return;
        const now = useGame.getState().catalogSource;
        if (now === "drive") return;
        const n = applyCatalog(JSON.parse(remote) as unknown);
        if (n) setCatalogSource("custom");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hydrated, driveTried, authPending, user, setCatalogSource]);

  useEffect(() => {
    if (!hydrated) return;
    const hide = () => {
      const el = document.getElementById("boot-splash");
      if (!el) return;
      el.classList.add("is-off");
      window.setTimeout(() => el.remove(), 400);
    };
    const img = new Image();
    img.src = "/bg/title.jpg";
    const wait = img.decode ? img.decode() : Promise.resolve();
    void wait.then(hide).catch(hide);
    const t = window.setTimeout(hide, 1200);
    return () => window.clearTimeout(t);
  }, [hydrated]);

  // Belt-and-suspenders: never leave boot splash stuck if hydrate stalls.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = document.getElementById("boot-splash");
      if (!el || el.classList.contains("is-off")) return;
      el.classList.add("is-off");
      window.setTimeout(() => el.remove(), 400);
    }, 3000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const open = () => setArtOpen(true);
    window.addEventListener("bansho-art-trial", open);
    return () => window.removeEventListener("bansho-art-trial", open);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [persist]);

  useEffect(() => {
    const cssPx = (name: string) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : 0;
    };
    let pinching = false;
    let zoomResetAt = 0;
    const resetPinchZoom = () => {
      const now = Date.now();
      if (now - zoomResetAt < 800) return;
      zoomResetAt = now;
      window.scrollTo(0, 0);
      const meta = document.querySelector('meta[name="viewport"]');
      const locked = meta?.getAttribute("content");
      if (!meta || !locked) return;
      meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
      requestAnimationFrame(() => {
        meta.setAttribute("content", locked);
      });
    };
    const fit = () => {
      if (pinching) return;
      const frame = frameRef.current;
      const stage = stageRef.current;
      if (!frame || !stage) return;
      const vv = window.visualViewport;
      const zoomed = isPinchZoom(vv?.scale);
      const box = stageFrame({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualWidth: vv?.width,
        visualHeight: vv?.height,
        offsetLeft: vv?.offsetLeft,
        offsetTop: vv?.offsetTop,
        visualScale: vv?.scale,
        padL: cssPx("--sal"),
        padR: cssPx("--sar"),
        padT: cssPx("--sat"),
        padB: cssPx("--sab"),
      });
      frame.style.left = `${box.frameLeft}px`;
      frame.style.top = `${box.frameTop}px`;
      frame.style.width = `${box.frameWidth}px`;
      frame.style.height = `${box.frameHeight}px`;
      // Clear inset/right/bottom so width/height are not stretched against right:0/bottom:0
      // (CSS inset:0 leftover conflicts with visualViewport offsetLeft/offsetTop outside FS).
      frame.style.right = "auto";
      frame.style.bottom = "auto";
      frame.style.inset = "";

      stage.style.width = `${DESIGN_W}px`;
      stage.style.height = `${DESIGN_H}px`;
      stage.style.transformOrigin = "top left";
      stage.style.transform = `scale(${box.scale})`;
      stage.style.left = `${box.stageLeft}px`;
      stage.style.top = `${box.stageTop}px`;
      // Drive mild inverse text scale in CSS (--text-scale on .game-stage).
      // When scale > 1, CSS keeps --text-scale at 1 so fonts enlarge with the stage.
      stage.style.setProperty("--stage-scale", String(box.scale));

      const portrait = box.frameHeight > box.frameWidth;
      setShowLandscapeHint(portrait && box.scale < PORTRAIT_TIP_SCALE);
      if (zoomed) resetPinchZoom();
    };
    const blockPinch = (event: Event) => {
      event.preventDefault();
    };
    const onGestureStart = (event: Event) => {
      blockPinch(event);
      pinching = true;
    };
    const onGestureEnd = (event: Event) => {
      blockPinch(event);
      pinching = false;
      fit();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    document.addEventListener("fullscreenchange", fit);
    document.addEventListener("webkitfullscreenchange", fit);
    document.addEventListener("gesturestart", onGestureStart, { passive: false });
    document.addEventListener("gesturechange", blockPinch, { passive: false });
    document.addEventListener("gestureend", onGestureEnd, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      document.removeEventListener("fullscreenchange", fit);
      document.removeEventListener("webkitfullscreenchange", fit);
      document.removeEventListener("gesturestart", onGestureStart);
      document.removeEventListener("gesturechange", blockPinch);
      document.removeEventListener("gestureend", onGestureEnd);
      document.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <div ref={frameRef} className="game-frame">
      {showLandscapeHint ? (
        <div className="game-landscape-hint" aria-live="polite">
          横表示推奨
        </div>
      ) : null}
      <div ref={stageRef} className="game-stage @container">
        {screen === "title" ? <TitleScreen /> : null}
        {screen === "palace" ? <PalaceScreen /> : null}
        {screen === "collection" ? <CollectionScreen /> : null}
        {screen === "formation" ? <FormationScreen /> : null}
        {screen === "map" ? <MapScreen /> : null}
        {screen === "scout" ? <ScoutScreen /> : null}
        {screen === "battle" ? <BattleView /> : null}
        {screen === "result" ? <ResultScreen /> : null}
        {screen === "summon" ? <SummonScreen /> : null}
        {screen === "train" ? <TrainScreen /> : null}
        {screen === "arena" ? <ArenaScreen /> : null}
        {helpOpen ? <HelpOverlay /> : null}
        {debugOpen ? <DebugPanel /> : null}
        {catalogOpen ? <CatalogPanel onClose={() => setCatalogOpen(false)} /> : null}
        {cardEditorOpen ? <CardEditorPanel onClose={() => setCardEditorOpen(false)} /> : null}
        {artOpen ? <ArtTrialOverlay onClose={() => setArtOpen(false)} /> : null}
        <ArtZoom />
      </div>
    </div>
  );
}
