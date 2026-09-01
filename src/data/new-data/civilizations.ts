import type { Civilization } from '../types';

/**
 * Civilizations that glow on the globe. Positions are approximate geographic
 * centroids. `periods` control when a civilization is "alive" on the timeline.
 */
export const CIVILIZATIONS: Civilization[] = [
    {
        id: 'mesopotamia',
        name: 'Mesopotamia',
        epithet: 'The Cradle of Cities',
        lat: 32.5,
        lon: 44.4,
        color: '#d8b46a',
        periods: [{ start: -3500, end: -539 }],
        rootNodeId: 'mesopotamia',
        blurb: 'Between two rivers, humanity wrote its first words.',
    },
    {
        id: 'egypt',
        name: 'Ancient Egypt',
        epithet: 'Gift of the Nile',
        lat: 26.8,
        lon: 30.8,
        color: '#e8c86a',
        periods: [{ start: -3000, end: -30 }],
        rootNodeId: 'egypt',
        blurb: 'A civilization of pyramids, gods, and eternal stone.',
    },
    {
        id: 'greece',
        name: 'Ancient Greece',
        epithet: 'The Birth of Reason',
        lat: 39.0,
        lon: 22.0,
        color: '#7ec8ff',
        periods: [{ start: -800, end: -146 }],
        rootNodeId: 'greece',
        blurb: 'Philosophy, democracy, and the measure of all things.',
    },
    {
        id: 'persia',
        name: 'Persian Empire',
        epithet: 'The King of Kings',
        lat: 32.0,
        lon: 53.0,
        color: '#ff9a5c',
        periods: [{ start: -550, end: 651 }],
        rootNodeId: 'persia',
        blurb: 'The first empire to span three continents.',
    },
    {
        id: 'india',
        name: 'Ancient India',
        epithet: 'The Land of Zero',
        lat: 21.0,
        lon: 78.0,
        color: '#ffb74d',
        periods: [{ start: -1500, end: 1200 }],
        rootNodeId: 'india',
        blurb: 'Where numbers found nothing, and nothing became everything.',
    },
    {
        id: 'china',
        name: 'Ancient China',
        epithet: 'The Middle Kingdom',
        lat: 34.5,
        lon: 108.0,
        color: '#ef5a6f',
        periods: [{ start: -1600, end: 1912 }],
        rootNodeId: 'china',
        blurb: 'Paper, powder, and the compass that turned the world.',
    },
    {
        id: 'rome',
        name: 'Roman Empire',
        epithet: 'The Eternal City',
        lat: 41.9,
        lon: 12.5,
        color: '#e0533d',
        periods: [{ start: -509, end: 476 }],
        rootNodeId: 'rome',
        blurb: 'Roads, law, and legions that bound a world together.',
    },
    {
        id: 'islamic-golden-age',
        name: 'Islamic Golden Age',
        epithet: 'The House of Wisdom',
        lat: 33.3,
        lon: 44.4,
        color: '#63d4a0',
        periods: [{ start: 750, end: 1258 }],
        rootNodeId: 'islamic-golden-age',
        blurb: 'Baghdad translated the world and invented the algorithm.',
    },
    {
        id: 'renaissance',
        name: 'Renaissance Italy',
        epithet: 'The Rebirth',
        lat: 43.8,
        lon: 11.25,
        color: '#d9b96b',
        periods: [{ start: 1300, end: 1600 }],
        rootNodeId: 'renaissance',
        blurb: 'Art and science awaken from a thousand-year sleep.',
    },
    {
        id: 'ottoman',
        name: 'Ottoman Empire',
        epithet: 'The Sublime Porte',
        lat: 39.0,
        lon: 35.0,
        color: '#6bd39a',
        periods: [{ start: 1299, end: 1922 }],
        rootNodeId: 'ottoman',
        blurb: 'Three continents ruled from a city of two seas.',
    },
    {
        id: 'spain',
        name: 'Imperial Spain',
        epithet: 'The Age of Sail',
        lat: 40.4,
        lon: -3.7,
        color: '#ffcf6b',
        periods: [{ start: 1492, end: 1898 }],
        rootNodeId: 'spain',
        blurb: 'Caravels crossed the ocean and redrew the map of Earth.',
    },
    {
        id: 'industrial-britain',
        name: 'Industrial Britain',
        epithet: 'The Age of Steam',
        lat: 52.5,
        lon: -1.9,
        color: '#9fd6a0',
        periods: [{ start: 1760, end: 1900 }],
        rootNodeId: 'industrial-britain',
        blurb: 'Steam and steel forged the modern world.',
    },
    {
        id: 'germany',
        name: 'German Empire',
        epithet: 'The Age of Science',
        lat: 51.0,
        lon: 10.0,
        color: '#a9b4ff',
        periods: [{ start: 1871, end: 1945 }],
        rootNodeId: 'germany',
        blurb: 'Where physics bent space, time, and the century itself.',
    },
    {
        id: 'modern-computing',
        name: 'The Digital Age',
        epithet: 'The Thinking Machine',
        lat: 37.4,
        lon: -122.1,
        color: '#7ee0d3',
        periods: [{ start: 1900, end: 2100 }],
        rootNodeId: 'modern-computing',
        blurb: 'Logic became lightning, and machines began to think.',
    },
    {
        id: 'byzantine',
        name: 'Byzantine Empire',
        epithet: 'The New Rome',
        lat: 41.0,
        lon: 28.9,
        color: '#c49bcc',
        periods: [{ start: 330, end: 1453 }],
        rootNodeId: 'byzantine',
        blurb: 'For a thousand years, Constantinople held the flame of Rome alive.',
    },
    {
        id: 'viking',
        name: 'Viking Age',
        epithet: 'The Age of Longships',
        lat: 60.5,
        lon: 8.5,
        color: '#7ec0d8',
        periods: [{ start: 793, end: 1066 }],
        rootNodeId: 'viking',
        blurb: 'Dragons prow first into the unknown — from Baghdad to Vinland.',
    },
    {
        id: 'medieval-japan',
        name: 'Medieval Japan',
        epithet: 'The Way of the Warrior',
        lat: 35.7,
        lon: 139.7,
        color: '#f4a5b0',
        periods: [{ start: 794, end: 1868 }],
        rootNodeId: 'medieval-japan',
        blurb: 'In silence and steel, a civilisation refined itself to perfection.',
    },
    {
        id: 'mongol',
        name: 'Mongol Empire',
        epithet: 'The World Conqueror',
        lat: 47.9,
        lon: 106.9,
        color: '#c8b46a',
        periods: [{ start: 1206, end: 1368 }],
        rootNodeId: 'mongol',
        blurb: 'From the steppe, one people knit the world into a single empire.',
    },
    {
        id: 'mali',
        name: 'Mali Empire',
        epithet: 'The Golden Kingdom',
        lat: 12.4,
        lon: -7.9,
        color: '#f4c46a',
        periods: [{ start: 1235, end: 1600 }],
        rootNodeId: 'mali',
        blurb: 'Where gold met salt, and Timbuktu became the city of books.',
    },
    {
        id: 'aztec',
        name: 'Aztec Empire',
        epithet: 'The Sun People',
        lat: 19.4,
        lon: -99.1,
        color: '#e07040',
        periods: [{ start: 1345, end: 1521 }],
        rootNodeId: 'aztec',
        blurb: 'On a lake, they built a city; for the sun, they fed the sky.',
    },
    {
        id: 'maya',
        name: 'Maya Civilisation',
        epithet: 'The Star Readers',
        lat: 16.0,
        lon: -89.0,
        color: '#6bbf8a',
        periods: [{ start: -2000, end: 1500 }],
        rootNodeId: 'maya',
        blurb: 'In the rainforest they wrote in stars, stone, and silence.',
    },
    {
        id: 'inca',
        name: 'Inca Empire',
        epithet: 'The Children of the Sun',
        lat: -13.5,
        lon: -72.0,
        color: '#d4a843',
        periods: [{ start: 1438, end: 1572 }],
        rootNodeId: 'inca',
        blurb: 'Without writing or wheels, they built an empire in the clouds.',
    },
    {
        id: 'mughal',
        name: 'Mughal Empire',
        epithet: 'The Peacock Throne',
        lat: 27.2,
        lon: 78.0,
        color: '#8fbf7f',
        periods: [{ start: 1526, end: 1857 }],
        rootNodeId: 'mughal',
        blurb: 'From Babur\'s sword to Akbar\'s tolerance, an empire of marble and verse.',
    },
    {
        id: 'phoenicia',
        name: 'Phoenician Civilisation',
        epithet: 'The Alphabet Traders',
        lat: 33.9,
        lon: 35.5,
        color: '#9b6ecc',
        periods: [{ start: -1500, end: -300 }],
        rootNodeId: 'phoenicia',
        blurb: 'They gave the world its letters and sailed to the edge of the sea.',
    },
    {
        id: 'korea',
        name: 'Ancient Korea',
        epithet: 'The Land of Morning Calm',
        lat: 37.5,
        lon: 127.0,
        color: '#6ab0d6',
        periods: [{ start: -57, end: 1897 }],
        rootNodeId: 'korea',
        blurb: 'Between giants, Korea forged a language, a press, and an identity of its own.',
    },
];

export const CIVILIZATION_MAP: Record<string, Civilization> = Object.fromEntries(
    CIVILIZATIONS.map((c) => [c.id, c])
);

/** Whether a civilization is glowing at the given year. */
export function isCivilizationActive(civ: Civilization, year: number): boolean {
    return civ.periods.some((p) => year >= p.start && year <= p.end);
}

/** All civilizations glowing at a given year. */
export function activeCivilizations(year: number): Civilization[] {
    return CIVILIZATIONS.filter((c) => isCivilizationActive(c, year));
}

/**
 * How "close" to peak a civilization is at a given year (0..1), used to
 * modulate glow intensity so empires wax and wane instead of blinking on/off.
 */
export function civilizationIntensity(civ: Civilization, year: number): number {
    let best = 0;
    for (const p of civ.periods) {
        if (year < p.start || year > p.end) continue;
        const span = p.end - p.start || 1;
        const t = (year - p.start) / span;
        // Bell curve peaking in the middle of the period.
        const bell = Math.sin(Math.PI * t);
        best = Math.max(best, 0.35 + 0.65 * bell);
    }
    return best;
}
