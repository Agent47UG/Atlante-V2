// ─────────────────────────────────────────────────────────────────────────────
// StoriesMenu — build-your-own guided stories, opened from the nav.
//
// Type any concept(s) and a story is assembled live from the knowledge graph
// via the backend. Example prompts demonstrate the free-text engine.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { Story } from '../data/types';
import { CIVILIZATION_MAP } from '../data/new-data/civilizations';

/** Example prompts shown under the input to hint the free-text story engine. */
const STORY_PROMPT_EXAMPLES = [
    'How did zero become the computer?',
    'gunpowder to the internet',
    'silk road',
    'democracy to the modern world',
];

interface StoriesMenuProps {
    open: boolean;
    stories: Story[];
    onPlay: (id: string) => void;
    onBuild: (text: string) => boolean | Promise<boolean>;
    onClose: () => void;
}

export default function StoriesMenu({ open, stories, onPlay, onBuild, onClose }: StoriesMenuProps) {
    const [text, setText] = useState('');
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // Reset the field each time the menu is opened, and focus it.
    useEffect(() => {
        if (open) {
            setText('');
            setError(false);
            setBusy(false);
            const id = window.setTimeout(() => inputRef.current?.focus(), 340);
            return () => window.clearTimeout(id);
        }
    }, [open]);

    const build = async (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || busy) return;
        setError(false);
        setBusy(true);
        try {
            const ok = await onBuild(trimmed);
            if (!ok) setError(true);
        } finally {
            setBusy(false);
        }
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void build(text);
    };

    return (
        <div className={`stories-menu${open ? ' is-open' : ''}`} aria-hidden={!open} role="dialog">
            {open && (
                <div className="stories-inner">
                    <button className="stories-close" onClick={onClose} aria-label="Close stories">
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                d="M6 6 L18 18 M18 6 L6 18"
                            />
                        </svg>
                    </button>
                    <header className="stories-head">
                        <span className="stories-mark" aria-hidden="true">✦</span>
                        <div className="stories-eyebrow">Guided journeys</div>
                        <h2 className="stories-title">Stories</h2>
                        <p className="stories-sub">
                            Name any people, places, or ideas — and watch a path light up between them.
                        </p>
                    </header>

                    <form className="stories-build" onSubmit={onSubmit}>
                        <div className={`stories-build-row${error ? ' has-error' : ''}`}>
                            <span className="stories-input-glyph" aria-hidden="true">✦</span>
                            <input
                                ref={inputRef}
                                className="stories-input"
                                type="text"
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    if (error) setError(false);
                                }}
                                placeholder="e.g. how did zero become the computer?"
                                aria-label="Describe a story to build"
                            />
                            <button className="stories-build-btn" type="submit" disabled={!text.trim() || busy}>
                                {busy ? 'Charting…' : 'Chart it'}
                            </button>
                        </div>
                        {busy && (
                            <p className="stories-loading" role="status" aria-live="polite">
                                Charting your story
                                <span className="stories-dots" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </p>
                        )}
                        {error && (
                            <p className="stories-error" role="alert">
                                Couldn’t find that in the atlas. Try naming a person, place, or invention —
                                like “paper”, “Rome”, or “the compass”.
                            </p>
                        )}
                        <div className="stories-examples">
                            {STORY_PROMPT_EXAMPLES.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    className="stories-example"
                                    disabled={busy}
                                    onClick={() => {
                                        setText(p);
                                        void build(p);
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </form>

                    {stories.length > 0 && (
                        <section className="stories-suggest">
                            <div className="stories-suggest-eyebrow">
                                <span className="stories-rule" aria-hidden="true" />
                                Or follow a charted path
                                <span className="stories-rule" aria-hidden="true" />
                            </div>
                            <ul className="stories-list">
                                {stories.map((s) => {
                                    const civ = CIVILIZATION_MAP[s.civilizationId];
                                    return (
                                        <li key={s.id}>
                                            <button className="story-card" onClick={() => onPlay(s.id)}>
                                                <span className="story-card-glyph" aria-hidden="true">✦</span>
                                                <span className="story-card-body">
                                                    <span className="story-card-q">{s.question}</span>
                                                    <span className="story-card-meta">
                                                        {civ ? civ.name : s.civilizationId} · {s.steps.length} steps
                                                    </span>
                                                </span>
                                                <span className="story-card-arrow" aria-hidden="true">→</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
