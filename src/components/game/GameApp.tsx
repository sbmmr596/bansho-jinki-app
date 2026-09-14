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
import { ArtZoom } from "./pieces";

const ASPECT = 16 / 9;

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

      const pad = 8;
      const left = Math.max(cssPx("--sal"), pad);
      const right = Math.max(cssPx("--sar"), pad);
      const top = Math.max(cssPx("--sat"), pad);
      const bottom = Math.max(cssPx("--sab"), pad);
      const aw = Math.max(1, vw - left - right);
      const ah = Math.max(1, vh - top - bottom);
      const portrait = vh > vw;
      let sw: number;
      let sh: number;
      if (portrait) {
        const maxW = ah;
        const maxH = aw;
        sh = Math.min(maxH, maxW / ASPECT);
        sw = sh * ASPECT;
        stage.style.transform = "translate(-50%, -50%) rotate(90deg)";
      } else {
        sh = Math.min(ah, aw / ASPECT);
        sw = sh * ASPECT;
        if (sw > aw) {
          sw = aw;
          sh = sw / ASPECT;
        }
        stage.style.transform = "translate(-50%, -50%)";
      }
      stage.style.width = `${Math.floor(sw)}px`;
      stage.style.height = `${Math.floor(sh)}px`;
      stage.style.left = "50%";
      stage.style.top = "50%";
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
      <div ref={stageRef} className="game-stage">
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
        {helpOpen ? <HelpOverlay /> : null}
        {debugOpen ? <DebugPanel /> : null}
        {catalogOpen ? <CatalogPanel onClose={() => setCatalogOpen(false)} /> : null}
        {artOpen ? <ArtTrialOverlay onClose={() => setArtOpen(false)} /> : null}
        <ArtZoom />
      </div>
    </div>
  );
}
