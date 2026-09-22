import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { applyCatalog } from "@/game/data";
import { loadUserCatalog } from "@/game/catalog-api";
import { loadDriveCatalog } from "@/game/drive-catalog";
import { GH_KEY, loadGithubCatalog } from "@/game/github-catalog";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ArtTrialOverlay } from "./ArtTrialOverlay";
import { BattleView } from "./BattleView";
import { CatalogPanel } from "./CatalogPanel";
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
import { DESIGN_H, DESIGN_W } from "@/game/design";

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
  const setCatalogOpen = useGame((s) => s.setCatalogOpen);
  const setCatalogSource = useGame((s) => s.setCatalogSource);
  const { user, isPending: authPending } = useCurrentUserState();
  const [artOpen, setArtOpen] = useState(false);
  const [driveTried, setDriveTried] = useState(false);
  const [githubTried, setGithubTried] = useState(false);
  const [showLandscapeHint, setShowLandscapeHint] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
    if (!hydrated || !driveTried) return;
    if (useGame.getState().catalogSource === "drive") {
      setGithubTried(true);
      return;
    }
    let repo = "";
    try {
      repo = localStorage.getItem(GH_KEY)?.trim() ?? "";
    } catch {
      repo = "";
    }
    if (!repo) {
      setGithubTried(true);
      return;
    }
    let cancelled = false;
    void loadGithubCatalog({ data: repo })
      .then((result) => {
        if (cancelled || !result.ok || result.status !== "loaded") return;
        if (useGame.getState().catalogSource === "drive") return;
        const n = applyCatalog(JSON.parse(result.payload) as unknown);
        if (n) setCatalogSource("github");
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setGithubTried(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, driveTried, setCatalogSource]);

  useEffect(() => {
    if (!hydrated || !driveTried || !githubTried || authPending || !user) return;
    const src = useGame.getState().catalogSource;
    if (src === "drive" || src === "github") return;
    let cancelled = false;
    void loadUserCatalog()
      .then((remote) => {
        if (cancelled || !remote) return;
        const now = useGame.getState().catalogSource;
        if (now === "drive" || now === "github") return;
        const n = applyCatalog(JSON.parse(remote) as unknown);
        if (n) setCatalogSource("custom");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hydrated, driveTried, githubTried, authPending, user, setCatalogSource]);

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
    const fit = () => {
      const frame = frameRef.current;
      const stage = stageRef.current;
      if (!frame || !stage) return;
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const vh = vv?.height ?? window.innerHeight;
      const ox = vv?.offsetLeft ?? 0;
      const oy = vv?.offsetTop ?? 0;
      frame.style.left = `${ox}px`;
      frame.style.top = `${oy}px`;
      frame.style.width = `${Math.floor(vw)}px`;
      frame.style.height = `${Math.floor(vh)}px`;

      // Safe-area padding on outer letterbox only (stage stays full design size).
      const padL = cssPx("--sal");
      const padR = cssPx("--sar");
      const padT = cssPx("--sat");
      const padB = cssPx("--sab");
      const aw = Math.max(1, vw - padL - padR);
      const ah = Math.max(1, vh - padT - padB);
      const scale = Math.min(aw / DESIGN_W, ah / DESIGN_H);

      stage.style.width = `${DESIGN_W}px`;
      stage.style.height = `${DESIGN_H}px`;
      stage.style.transformOrigin = "top left";
      stage.style.transform = `scale(${scale})`;
      stage.style.left = `${padL + (aw - DESIGN_W * scale) / 2}px`;
      stage.style.top = `${padT + (ah - DESIGN_H * scale) / 2}px`;
      // Drive mild inverse text scale in CSS (--text-scale on .game-stage).
      stage.style.setProperty("--stage-scale", String(scale));

      const portrait = vh > vw;
      setShowLandscapeHint(portrait && scale < PORTRAIT_TIP_SCALE);
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
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
        {artOpen ? <ArtTrialOverlay onClose={() => setArtOpen(false)} /> : null}
        <ArtZoom />
      </div>
    </div>
  );
}
