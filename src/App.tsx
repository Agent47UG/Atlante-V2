import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Globe from "./components/Globe";
import Timeline from "./components/Timeline";
import GraphExplorer from "./components/GraphExplorer";
import StoriesMenu from "./components/StoriesMenu";
import Starfield from "./components/Starfield";
import {
  CIVILIZATIONS,
  CIVILIZATION_MAP,
  activeCivilizations,
} from "./data/new-data/civilizations";
import { STORY_MAP, storiesForCivilization } from "./data/new-data/stories";
import { buildStoryFromText } from "./data/new-data/storyBuilder";
import type { Story } from "./data/types";
import { NODE_MAP } from "./data/new-data/graph";

type Stage = "splash" | "moving" | "ready";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// A curated handful of hand-authored stories offered as suggestions beneath the
// "build your own" box. The full set still resolves for playback via STORY_MAP.
const SUGGESTED_STORY_IDS = [
  "zero-to-computer",
  "paper-to-print",
  "compass-to-newworld",
  "alphabet-to-internet",
  "longship-to-moon",
  "gold-to-algorithm",
];
const SUGGESTED_STORIES = SUGGESTED_STORY_IDS.map((id) => STORY_MAP[id]).filter(
  Boolean,
) as Story[];

export default function App() {
  const [year, setYear] = useState(0);
  const [selectedCivId, setSelectedCivId] = useState<string | null>(null);
  const [focusStack, setFocusStack] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<{ id: string; step: number } | null>(null);
  // Stories the user builds by typing free text. Kept alongside the authored
  // STORY_MAP so playback can resolve either kind by id.
  const [dynamicStories, setDynamicStories] = useState<Record<string, Story>>({});
  const [stage, setStage] = useState<Stage>("splash");
  const [menuOpen, setMenuOpen] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);
  // Drives the full-bleed "ground" container layout. It turns on the instant a
  // civilization is opened, but lingers after closing until the globe has flown
  // all the way back — otherwise the container snaps to its small centred box
  // mid-flight and clips the still-zoomed globe.
  const [groundVisual, setGroundVisual] = useState(false);
  const splashTitleRef = useRef<HTMLHeadingElement>(null);
  const navTitleRef = useRef<HTMLHeadingElement>(null);

  const selectedCiv = selectedCivId ? CIVILIZATION_MAP[selectedCivId] ?? null : null;
  const groundMode = selectedCiv !== null;
  const settleTimer = useRef<number | null>(null);
  useEffect(() => {
    if (groundMode) {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
      setGroundVisual(true);
    } else {
      // The globe reports when it finishes flying home (handleGroundSettled),
      // but keep a generous fallback so the container can never get stuck in the
      // full-bleed layout if that frame callback is ever missed.
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setGroundVisual(false), 2500);
    }
    return () => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };
  }, [groundMode]);
  const handleGroundSettled = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    setGroundVisual(false);
  }, []);
  const focusId = focusStack.length ? focusStack[focusStack.length - 1] : null;
  const prevFocusId =
    focusStack.length > 1 ? focusStack[focusStack.length - 2] : null;
  const civStories = useMemo(
    () => (selectedCiv ? storiesForCivilization(selectedCiv.id) : []),
    [selectedCiv],
  );
  const getStory = useCallback(
    (id: string): Story | undefined => dynamicStories[id] ?? STORY_MAP[id],
    [dynamicStories],
  );
  const resolvedStory = useMemo(() => {
    if (!activeStory) return null;
    const story = dynamicStories[activeStory.id] ?? STORY_MAP[activeStory.id];
    return story ? { story, step: activeStory.step } : null;
  }, [activeStory, dynamicStories]);
  const activeCount = useMemo(() => activeCivilizations(year).length, [year]);

  // ── Actions ────────────────────────────────────────────────────────────
  const selectCiv = (id: string) => {
    const civ = CIVILIZATION_MAP[id];
    if (!civ) return;
    setSelectedCivId(id);
    setFocusStack([civ.rootNodeId]);
    setActiveStory(null);
    setStoriesOpen(false);
  };
  const focusNode = (id: string) =>
    setFocusStack((s) => (s[s.length - 1] === id ? s : [...s, id]));
  const backFocus = () => setFocusStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const closeCiv = () => {
    setSelectedCivId(null);
    setFocusStack([]);
    setActiveStory(null);
  };
  const startStory = useCallback((story: Story) => {
    const civ = CIVILIZATION_MAP[story.civilizationId];
    setSelectedCivId(story.civilizationId);
    setFocusStack(civ ? [civ.rootNodeId] : []);
    setActiveStory({ id: story.id, step: 0 });
    setStoriesOpen(false);
  }, []);
  const playStory = useCallback(
    (id: string) => {
      const story = getStory(id);
      if (story) startStory(story);
    },
    [getStory, startStory],
  );
  // Build a story from free-typed text, register it, and play it. Returns false
  // when nothing in the text matched a concept (so the menu can hint the user).
  const buildAndPlayStory = useCallback(
    (text: string): boolean => {
      const story = buildStoryFromText(text);
      if (!story) return false;
      setDynamicStories((prev) => ({ ...prev, [story.id]: story }));
      startStory(story);
      return true;
    },
    [startStory],
  );
  const storyStep = (delta: number) =>
    setActiveStory((a) => {
      const story = a && (dynamicStories[a.id] ?? STORY_MAP[a.id]);
      return a && story
        ? { id: a.id, step: clamp(a.step + delta, 0, story.steps.length - 1) }
        : a;
    });
  const exitStory = () => setActiveStory(null);

  // ── Intro animation (unchanged): FLIP the splash title into the nav. ────
  useLayoutEffect(() => {
    const splash = splashTitleRef.current;
    const navTitle = navTitleRef.current;
    if (!splash || !navTitle) return;

    let t1: number | undefined;
    let t2: number | undefined;
    let cancelled = false;

    const runIntro = () => {
      if (cancelled) return;
      t1 = window.setTimeout(() => {
        if (cancelled) return;
        const splashRect = splash.getBoundingClientRect();
        const targetRect = navTitle.getBoundingClientRect();
        const s = targetRect.height / splashRect.height;
        const dx = targetRect.left - splashRect.left;
        const dy = targetRect.top - splashRect.top;
        splash.style.transformOrigin = "top left";
        splash.style.transition =
          "transform 900ms cubic-bezier(0.65, 0, 0.35, 1), opacity 400ms ease 1050ms";
        splash.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
        splash.style.opacity = "0";
        setStage("moving");
      }, 1300);

      t2 = window.setTimeout(() => {
        if (cancelled) return;
        setStage("ready");
      }, 1300 + 1050);
    };

    const fonts = (
      document as Document & { fonts?: { ready: Promise<unknown> } }
    ).fonts;
    if (fonts?.ready) {
      fonts.ready.then(runIntro);
    } else {
      runIntro();
    }

    return () => {
      cancelled = true;
      if (t1 !== undefined) window.clearTimeout(t1);
      if (t2 !== undefined) window.clearTimeout(t2);
    };
  }, []);

  // ── Keyboard: story stepping + Escape to back out. ─────────────────────
  useEffect(() => {
    if (stage !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        if (activeStory) {
          e.preventDefault();
          exitStory();
        } else if (selectedCiv) {
          e.preventDefault();
          closeCiv();
        } else if (storiesOpen) {
          e.preventDefault();
          setStoriesOpen(false);
        }
      } else if (activeStory && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        storyStep(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, activeStory, selectedCiv, storiesOpen, dynamicStories]);

  // As you walk the graph, follow each focus node's civilization: shift the
  // globe/ground to it and move the (hidden) timeline into that era.
  useEffect(() => {
    if (!focusId) return;
    const civId = NODE_MAP[focusId]?.civilizationId;
    if (!civId || civId === selectedCivId) return;
    const civ = CIVILIZATION_MAP[civId];
    if (!civ) return;
    setSelectedCivId(civId);
    const p = civ.periods[0];
    if (p) setYear(Math.round((p.start + p.end) / 2));
  }, [focusId, selectedCivId]);

  return (
    <div className={`app stage-${stage}${groundVisual ? " is-ground" : ""}`}>
      <Starfield />
      {stage !== "ready" && (
        <div className="splash-overlay" aria-hidden="true">
          <h1 className="splash-title" ref={splashTitleRef}>
            Atlante
          </h1>
        </div>
      )}
      <header className="nav">
        {selectedCiv && (
          <button
            type="button"
            className="nav-back-mobile"
            onClick={closeCiv}
            aria-label="Back to globe view"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 12 H5 M11 6 L5 12 L11 18"
              />
            </svg>
          </button>
        )}
        {!selectedCiv && (
          <button
            type="button"
            className="nav-stories-mobile"
            onClick={() => setStoriesOpen(true)}
            aria-label="Open stories"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.7"
                d="M3.5 16 L8 10.5 L13.5 13 L19.5 6.5"
              />
              <circle cx="3.5" cy="16" r="1.25" fill="currentColor" />
              <circle cx="8" cy="10.5" r="1.7" fill="currentColor" />
              <circle cx="13.5" cy="13" r="1.15" fill="currentColor" />
              <circle cx="19.5" cy="6.5" r="1.45" fill="currentColor" />
            </svg>
          </button>
        )}
        <div className="nav-left">
          <div className="nav-mark" aria-hidden="true">
            <span className="nav-mark-glyph" aria-hidden="true">
              <svg viewBox="-12 -12 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M0 -10 L2.2 -2.2 L10 0 L2.2 2.2 L0 10 L-2.2 2.2 L-10 0 L-2.2 -2.2 Z"
                />
              </svg>
            </span>
          </div>
          <div className="nav-titles">
            <h1 className="nav-title" ref={navTitleRef}>
              Atlante
            </h1>
            <p className="nav-subtitle">A Visual History of the World</p>
          </div>
        </div>
        <div className="nav-right-actions">
          <button
            type="button"
            className={`nav-back-globe${selectedCiv ? ' is-visible' : ''}`}
            onClick={closeCiv}
            aria-label="Back to globe view"
            aria-hidden={!selectedCiv}
            tabIndex={selectedCiv ? 0 : -1}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 12 H5 M11 6 L5 12 L11 18"
              />
            </svg>
            Globe
          </button>
          <button
            type="button"
            className="nav-explore"
            onClick={() => setStoriesOpen(true)}
          >
            Stories
          </button>
        </div>
        <button
          type="button"
          className={`nav-menu-toggle${menuOpen ? " is-open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="nav-menu-bar" />
          <span className="nav-menu-bar" />
          <span className="nav-menu-bar" />
        </button>
        <nav
          className={`nav-links${menuOpen ? " is-open" : ""}`}
          aria-label="Social links"
          onClick={() => setMenuOpen(false)}
        >
          <a
            className="nav-link"
            href="https://www.ujwal.site/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Portfolio"
            title="Portfolio"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 8 3 12l5 4M16 8l5 4-5 4M14 5l-4 14"
              />
            </svg>
          </a>
          <a
            className="nav-link"
            href="https://github.com/Agent47UG"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"
              />
            </svg>
          </a>
          <a
            className="nav-link"
            href="https://www.linkedin.com/in/ujwal-ghodeswar-268209241"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            title="LinkedIn"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="currentColor"
                d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.28V1.72C24 .77 23.2 0 22.22 0z"
              />
            </svg>
          </a>
          <div className="nav-drawer-byline" aria-label="Author">
            <span className="nav-drawer-byline-label">By</span>
            <span className="nav-drawer-byline-name">Ujwal</span>
          </div>
        </nav>
      </header>
      <div className="globe-stage">
        <Globe
          civilizations={CIVILIZATIONS}
          selectedCivId={selectedCivId}
          onSelectCiv={selectCiv}
          year={year}
          groundMode={groundMode}
          onGroundSettled={handleGroundSettled}
        />
      </div>
      <GraphExplorer
        civ={selectedCiv}
        focusId={focusId}
        prevFocusId={prevFocusId}
        canBack={focusStack.length > 1}
        stories={civStories}
        activeStory={resolvedStory}
        onFocusNode={focusNode}
        onBackFocus={backFocus}
        onClose={closeCiv}
        onPlayStory={playStory}
        onStoryStep={storyStep}
        onExitStory={exitStory}
      />
      <StoriesMenu
        open={storiesOpen}
        stories={SUGGESTED_STORIES}
        onPlay={playStory}
        onBuild={buildAndPlayStory}
        onClose={() => setStoriesOpen(false)}
      />
      <Timeline year={year} onYear={setYear} activeCount={activeCount} />
      <div className="byline" aria-label="Author">
        <span className="byline-label">By</span>
        <span className="byline-name">Ujwal</span>
      </div>
    </div>
  );
}
