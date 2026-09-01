// ─────────────────────────────────────────────────────────────────────────────
// GraphExplorer — the "civilization as ground" sky view.
//
// Opened when a civilization is selected: the globe drops to the bottom as the
// ground and this transparent overlay explores that civilization's knowledge
// graph in the sky above. It shows one FOCUS node + its direct neighbours;
// clicking a neighbour re-centres on it (fading the rest). It can also play a
// guided Story: a sequence of nodes lit as a single thread with captions.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Civilization, Story, KnowledgeNode } from '../data/types';
import { NODE_MAP, edgeBetween, pathBetween } from '../data/new-data/graph';
import {
    expand,
    subscribe as subscribeStore,
    isLoading as isNodeLoading,
    loadError as nodeLoadError,
} from '../data/new-data/liveStore';
import { CIVILIZATION_MAP } from '../data/new-data/civilizations';
import { countryName } from '../lib/countries';
import { formatYear as fmtYear } from '../data/new-data/timeline';
import {
    nodeRadius,
    buildFocusView,
    buildPathView,
    hashUnit,
} from '../lib/graphView';
import type { PlacedNode, FocusView } from '../lib/graphView';

export interface ActiveStory {
    story: Story;
    step: number;
}

interface ConnectionHop {
    key: string;
    toLabel: string;
    verb: string | null;
    forward: boolean;
}

/** The linking words shown between two nodes in the relationship sentence. */
function connectorWord(hop: ConnectionHop, index: number): string {
    if (hop.forward) {
        const verb = hop.verb ?? 'leads to';
        return index === 0 ? verb : `which ${verb}`;
    }
    const verb = hop.verb ?? 'linked to';
    return index === 0 ? `${verb} by` : `which ${verb} by`;
}

interface GraphExplorerProps {
    civ: Civilization | null;
    focusId: string | null;
    prevFocusId: string | null;
    canBack: boolean;
    stories: Story[];
    activeStory: ActiveStory | null;
    onFocusNode: (id: string) => void;
    onBackFocus: () => void;
    onClose: () => void;
    onPlayStory: (id: string) => void;
    onStoryStep: (delta: number) => void;
    onExitStory: () => void;
}

export default function GraphExplorer({
    civ,
    focusId,
    prevFocusId,
    activeStory,
    onFocusNode,
    onStoryStep,
    onExitStory,
}: GraphExplorerProps) {
    const [hoverId, setHoverId] = useState<string | null>(null);
    // Bumped whenever the live store merges new nodes, so the memoised views
    // recompute and freshly-fetched neighbours appear.
    const [storeVersion, setStoreVersion] = useState(0);
    useEffect(() => subscribeStore(() => setStoreVersion((v) => v + 1)), []);
    // Expanding ANY focused node fetches its neighbours from the internet
    // (civilization seeds bridge via their label; live Q-nodes fetch directly).
    useEffect(() => {
        if (focusId) void expand(focusId);
    }, [focusId]);
    // Measure the sky band so we can lay out + render in real pixels (no
    // viewBox letterboxing that could push stars onto the globe).
    const canvasRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 1000, h: 560 });
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const r = entries[0].contentRect;
            if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [civ]);

    const focusView = useMemo(
        () => (focusId && !activeStory ? buildFocusView(focusId, size.w, size.h) : null),
        // storeVersion: recompute when live neighbours arrive.
        [focusId, activeStory, size.w, size.h, storeVersion],
    );

    const pathView = useMemo(
        () =>
            activeStory
                ? buildPathView(activeStory.story.steps.map((s) => s.nodeId), size.w, size.h)
                : null,
        [activeStory, size.w, size.h],
    );

    // ── Staged focus-switch animation ─────────────────────────────────────
    // On click: (1) every other node fades out while the clicked node glides to
    // the centre, (2) the new neighbours fade in, (3) the connecting lines
    // branch outward from the centre. Driven by a small phase machine so the
    // rendered view lags the controlled focusId until each stage completes.
    const COLLAPSE_MS = 480;
    const EXPAND_MS = 420;
    const BRANCH_MS = 560;

    type Phase = 'idle' | 'collapse' | 'expand' | 'branch';
    const [phase, setPhase] = useState<Phase>('idle');
    const [renderView, setRenderView] = useState<FocusView | null>(focusView);
    const [centerTarget, setCenterTarget] = useState<PlacedNode | null>(null);
    const shownViewRef = useRef<FocusView | null>(focusView);
    const timersRef = useRef<number[]>([]);

    const focusOf = (v: FocusView | null) =>
        v?.nodes.find((n) => n.isFocus)?.node.id;

    useEffect(() => {
        timersRef.current.forEach((t) => window.clearTimeout(t));
        timersRef.current = [];

        const prev = shownViewRef.current;

        if (!focusView) {
            shownViewRef.current = null;
            setRenderView(null);
            setCenterTarget(null);
            setPhase('idle');
            return;
        }

        const newFocus = focusOf(focusView);
        const prevFocus = focusOf(prev);

        // Same focus (e.g. a resize re-layout) or nothing shown yet: swap in
        // directly with a gentle expand → branch, no collapse.
        if (!prev || prevFocus === newFocus) {
            shownViewRef.current = focusView;
            setRenderView(focusView);
            setCenterTarget(null);
            if (!prev) {
                setPhase('expand');
                timersRef.current = [
                    window.setTimeout(() => setPhase('branch'), EXPAND_MS),
                    window.setTimeout(() => setPhase('idle'), EXPAND_MS + BRANCH_MS),
                ];
            } else {
                setPhase('idle');
            }
            return;
        }

        // Focus changed → run the full staged sequence.
        const nextFocusNode = focusView.nodes.find((n) => n.isFocus) ?? null;
        setRenderView(prev); // keep old view while it collapses
        setCenterTarget(nextFocusNode); // clicked node glides here (the centre)
        setPhase('collapse');

        timersRef.current = [
            window.setTimeout(() => {
                shownViewRef.current = focusView;
                setRenderView(focusView);
                setCenterTarget(null);
                setPhase('expand');
            }, COLLAPSE_MS),
            window.setTimeout(() => setPhase('branch'), COLLAPSE_MS + EXPAND_MS),
            window.setTimeout(
                () => setPhase('idle'),
                COLLAPSE_MS + EXPAND_MS + BRANCH_MS,
            ),
        ];

        return () => {
            timersRef.current.forEach((t) => window.clearTimeout(t));
            timersRef.current = [];
        };
    }, [focusView]);


    const isOpen = civ !== null;
    const focusNode = focusId ? NODE_MAP[focusId] : undefined;
    const hoverNode = hoverId ? NODE_MAP[hoverId] : undefined;
    const storyStepNode =
        activeStory ? NODE_MAP[activeStory.story.steps[activeStory.step]?.nodeId] : undefined;

    // What the header/detail describes: hovered node → story step → focus.
    const described = hoverNode ?? storyStepNode ?? focusNode;

    // Era / civilisation / country shown in the left-hand detail panel.
    const panelFacts = (node: KnowledgeNode | undefined) => {
        const factCiv = node?.civilizationId
            ? CIVILIZATION_MAP[node.civilizationId] ?? null
            : null;
        const era =
            node?.details?.era ??
            (node?.details?.born
                ? `${node.details.born}${
                      node.details.died ? ` – ${node.details.died}` : ''
                  }`
                : factCiv
                  ? factCiv.periods
                        .map((p) => `${fmtYear(p.start)} – ${fmtYear(p.end)}`)
                        .join(', ')
                  : null);
        return {
            civ: factCiv,
            era,
            country: factCiv ? countryName(factCiv.lat, factCiv.lon) : null,
        };
    };
    const {
        civ: describedCiv,
        era: describedEra,
        country: describedCountry,
    } = panelFacts(described);

    // The current story step, rendered in the same left panel as event info.
    const story =
        activeStory && storyStepNode
            ? {
                  node: storyStepNode,
                  caption: activeStory.story.steps[activeStory.step]?.caption ?? '',
                  step: activeStory.step,
                  total: activeStory.story.steps.length,
                  ...panelFacts(storyStepNode),
              }
            : null;

    // How the described node connects back to the node you arrived from: its
    // parent in the focus stack, or — when hovering a neighbour — the current
    // centre. Even when they aren't directly linked, we trace the shortest path
    // and read it as a chain ("X invented Y, which shaped Z").
    const connectionRefId = described
        ? described.id === focusId
            ? prevFocusId
            : focusId
        : null;
    const connection = useMemo(() => {
        if (!described || !connectionRefId || connectionRefId === described.id) {
            return null;
        }
        const path = pathBetween(connectionRefId, described.id, 3);
        if (!path || path.length < 2) return null;
        const hops: ConnectionHop[] = path.slice(1).map((toId, i) => {
            const fromId = path[i];
            const edge = edgeBetween(fromId, toId);
            return {
                key: `${fromId}->${toId}`,
                toLabel: NODE_MAP[toId]?.label ?? toId,
                verb: edge?.label ?? null,
                forward: edge ? edge.source === fromId : true,
            };
        });
        return { originLabel: NODE_MAP[path[0]]?.label ?? path[0], hops };
    }, [described, connectionRefId]);

    return (
        <div
            className={`graph-sky${isOpen ? ' is-open' : ''}`}
            aria-hidden={!isOpen}
            role="dialog"
            aria-label={civ ? `${civ.name} knowledge graph` : undefined}
        >
            {civ && (
                <>
                    {/* ── Event detail panel (left of the constellation) ──── */}
                    {!activeStory && described && (
                        <aside className="event-panel" key={described.id}>
                            {describedEra && (
                                <span className="event-panel-era">{describedEra}</span>
                            )}
                            <div className="event-panel-meta">
                                {describedCiv && (
                                    <span className="event-panel-civ">{describedCiv.name}</span>
                                )}
                                {describedCountry && (
                                    <span className="event-panel-country">{describedCountry}</span>
                                )}
                            </div>
                            <h2 className="event-panel-title">{described.label}</h2>
                            <p className="event-panel-desc">{described.summary}</p>
                            {connection && (
                                <p className="event-panel-connection">
                                    <span className="event-panel-connection-node">
                                        {connection.originLabel}
                                    </span>
                                    {connection.hops.map((hop, i) => (
                                        <span key={hop.key}>
                                            {' '}
                                            <span className="event-panel-connection-verb">
                                                {connectorWord(hop, i)}
                                            </span>{' '}
                                            <span className="event-panel-connection-node">
                                                {hop.toLabel}
                                            </span>
                                        </span>
                                    ))}
                                </p>
                            )}
                            {described.details?.contributions && (
                                <span className="event-panel-contrib">
                                    {described.details.contributions.join(' · ')}
                                </span>
                            )}
                        </aside>
                    )}

                    {/* ── Story detail panel (same left placement as events) ── */}
                    {story && (
                        <aside
                            className="event-panel event-panel--story"
                            key={`story-${story.step}`}
                        >
                            {story.era && (
                                <span className="event-panel-era">{story.era}</span>
                            )}
                            <div className="event-panel-meta">
                                {story.civ && (
                                    <span className="event-panel-civ">{story.civ.name}</span>
                                )}
                                {story.country && (
                                    <span className="event-panel-country">{story.country}</span>
                                )}
                            </div>
                            <h2 className="event-panel-title">{story.node.label}</h2>
                            <p className="event-panel-desc">{story.caption}</p>
                            <div className="event-panel-story-controls">
                                <div className="graph-story-controls">
                                    <button
                                        className="graph-story-btn"
                                        onClick={() => onStoryStep(-1)}
                                        disabled={story.step === 0}
                                    >
                                        ← Prev
                                    </button>
                                    <span className="graph-story-progress">
                                        {story.step + 1} / {story.total}
                                    </span>
                                    {story.step < story.total - 1 ? (
                                        <button
                                            className="graph-story-btn"
                                            onClick={() => onStoryStep(1)}
                                        >
                                            Next →
                                        </button>
                                    ) : (
                                        <button
                                            className="graph-story-btn"
                                            onClick={onExitStory}
                                        >
                                            Explore ✦
                                        </button>
                                    )}
                                </div>
                                <button className="graph-story-exit" onClick={onExitStory}>
                                    Exit story
                                </button>
                            </div>
                        </aside>
                    )}

                    {/* Event title + description temporarily hidden. */}

                    {/* ── Free exploration ────────────────────────────────── */}
                    <div className="graph-canvas" ref={canvasRef}>
                    {focusId && isNodeLoading(focusId) && (
                        <div className="graph-loading" aria-live="polite">
                            <span className="graph-loading-orbit" aria-hidden="true" />
                            Charting {focusNode?.label ?? 'the sky'}…
                        </div>
                    )}
                    {focusId && !isNodeLoading(focusId) && nodeLoadError(focusId) && (
                        <div className="graph-loading is-error" role="alert">
                            Couldn’t reach the archive — try that star again.
                        </div>
                    )}
                    {renderView && (
                        <svg
                            className="graph-svg"
                            viewBox={`0 0 ${size.w} ${size.h}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            {(phase === 'idle' || phase === 'branch' || phase === 'collapse') && (
                                <g className={`graph-edges${phase === 'collapse' ? ' is-exiting' : ''}`}>
                                    {renderView.edges.map((e) => {
                                        const active =
                                            hoverId === null ||
                                            hoverId === e.target ||
                                            hoverId === e.source;
                                        const mx = (e.a.x + e.b.x) / 2;
                                        const my = (e.a.y + e.b.y) / 2;
                                        const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y);
                                        return (
                                            <g
                                                key={e.target}
                                                className={`graph-edge${active ? '' : ' is-dim'}`}
                                            >
                                                <line
                                                    className="graph-edge-draw"
                                                    x1={e.a.x}
                                                    y1={e.a.y}
                                                    x2={e.b.x}
                                                    y2={e.b.y}
                                                    style={{ ['--edge-len']: `${len}` } as CSSProperties}
                                                />
                                                {e.label && active && phase !== 'collapse' && (
                                                    <text x={mx} y={my - 4} className="graph-edge-label">
                                                        {e.label}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </g>
                            )}

                            <g className="graph-nodes">
                                {renderView.nodes.map((p) => {
                                    const isCentering =
                                        !!centerTarget && p.node.id === centerTarget.node.id;
                                    const leaving = phase === 'collapse' && !isCentering;
                                    // Everything that isn't the clicked (centering) node or the
                                    // resting focus simply fades in at its final spot — it never
                                    // slides, so common nodes don't drift around.
                                    const entering = !isCentering && !leaving && !p.isFocus;
                                    const active = hoverId === null || hoverId === p.node.id;
                                    // Vary magnitude + twinkle per node so they read like stars.
                                    const r =
                                        nodeRadius(p.node.type, p.isFocus) *
                                        (0.85 + hashUnit(p.node.id, 7) * 0.5);
                                    const twinkle = {
                                        animationDelay: `${hashUnit(p.node.id, 8) * 4}s`,
                                        animationDuration: `${2.6 + hashUnit(p.node.id, 9) * 2.6}s`,
                                    };
                                    const px = isCentering ? centerTarget!.x : p.x;
                                    const py = isCentering ? centerTarget!.y : p.y;
                                    return (
                                        <g
                                            key={p.node.id}
                                            className={`graph-node type-${p.node.type}${
                                                p.isFocus ? ' is-focus' : ''
                                            }${active ? '' : ' is-dim'}${
                                                isCentering ? ' is-centering' : ''
                                            }${leaving ? ' is-leaving' : ''}${
                                                entering ? ' is-enter' : ''
                                            }`}
                                            style={{ transform: `translate(${px}px, ${py}px)` }}
                                            onPointerOver={() => setHoverId(p.node.id)}
                                            onPointerOut={() => setHoverId(null)}
                                            onClick={() => {
                                                if (!p.isFocus) onFocusNode(p.node.id);
                                            }}
                                        >
                                            <circle r={r * 3} className="graph-node-halo" />
                                            <circle r={r} className="graph-node-dot" style={twinkle} />
                                            <text
                                                y={r + 18}
                                                className="graph-node-label"
                                            >
                                                {p.node.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>

                            {renderView.hiddenCount > 0 && phase !== 'collapse' && (
                                <text
                                    x={size.w / 2}
                                    y={size.h - 8}
                                    className="graph-more"
                                >
                                    +{renderView.hiddenCount} more connections
                                </text>
                            )}
                        </svg>
                    )}

                    {/* ── Story path ──────────────────────────────────────── */}
                    {pathView && activeStory && (
                        <svg
                            className="graph-svg"
                            viewBox={`0 0 ${size.w} ${size.h}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            <g className="graph-edges">
                                {pathView.edges.map((e, i) => (
                                    <line
                                        key={i}
                                        className={`graph-edge-line${
                                            i < activeStory.step ? ' is-lit' : ''
                                        }`}
                                        x1={e.a.x}
                                        y1={e.a.y}
                                        x2={e.b.x}
                                        y2={e.b.y}
                                    />
                                ))}
                            </g>
                            <g className="graph-nodes">
                                {pathView.nodes.map((p, i) => {
                                    const isCurrent = i === activeStory.step;
                                    const isPast = i < activeStory.step;
                                    return (
                                        <g
                                            key={p.node.id}
                                            className={`graph-node type-${p.node.type}${
                                                isCurrent ? ' is-current' : ''
                                            }${isPast ? ' is-past' : ' is-future'}`}
                                            transform={`translate(${p.x} ${p.y})`}
                                            onClick={() => onStoryStep(i - activeStory.step)}
                                        >
                                            <circle
                                                r={nodeRadius(p.node.type, isCurrent) * 3}
                                                className="graph-node-halo"
                                            />
                                            <circle
                                                r={nodeRadius(p.node.type, isCurrent)}
                                                className="graph-node-dot"
                                            />
                                            <text
                                                y={nodeRadius(p.node.type, isCurrent) + 18}
                                                className="graph-node-label"
                                            >
                                                {p.node.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                    )}
                    </div>

                    {/* Story controls now live in the left detail panel above. */}
                </>
            )}
        </div>
    );
}
