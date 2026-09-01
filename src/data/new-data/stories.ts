import type { Story } from '../types';

/**
 * Guided journeys through the knowledge universe. Each story lights up a
 * sequence of nodes so users can *watch* an idea flow across centuries and
 * civilizations. The renderer connects consecutive steps, so a path reads as a
 * single luminous thread even when it leaps between distant parts of the graph.
 *
 * Every `nodeId` below is guaranteed to exist in `graph.ts`.
 */
export const STORIES: Story[] = [
    {
        id: 'renaissance-to-tech',
        question: 'How did Renaissance Italy shape modern technology?',
        civilizationId: 'renaissance',
        steps: [
            { nodeId: 'renaissance', caption: 'Florence reawakens the ancient thirst to understand the world.' },
            { nodeId: 'scientific-method', caption: 'A new discipline is born: observe, hypothesise, and test.' },
            { nodeId: 'galileo', caption: 'Galileo turns the method to the heavens and measures motion.' },
            { nodeId: 'isaac-newton', caption: 'Newton binds sky and earth under universal laws.' },
            { nodeId: 'classical-mechanics', caption: 'The clockwork universe becomes calculable.' },
            { nodeId: 'albert-einstein', caption: 'Einstein bends that clockwork into curved spacetime.' },
            { nodeId: 'quantum-mechanics', caption: 'Physics descends into the strange realm of the atom.' },
            { nodeId: 'transistor', caption: 'Quantum rules yield a switch of silicon.' },
            { nodeId: 'computer', caption: 'And the switch, multiplied a billionfold, learns to think.' },
        ],
    },
    {
        id: 'leonardo-to-flight',
        question: 'How did Leonardo’s dream of flight come true?',
        civilizationId: 'renaissance',
        steps: [
            { nodeId: 'leonardo-da-vinci', caption: 'Leonardo studies birds and sketches machines with wings.' },
            { nodeId: 'flying-machine', caption: 'His flying machine dreams four centuries too early.' },
            { nodeId: 'aerodynamics', caption: 'Slowly, science learns how air holds a wing aloft.' },
            { nodeId: 'wright-brothers', caption: 'In 1903, two brothers lift off for twelve immortal seconds.' },
            { nodeId: 'aviation', caption: 'Canvas biplanes give way to the age of flight.' },
            { nodeId: 'modern-air-travel', caption: 'Jet wings shrink the planet to a single day’s journey.' },
        ],
    },
    {
        id: 'zero-to-computer',
        question: 'How did the number zero become the computer?',
        civilizationId: 'india',
        steps: [
            { nodeId: 'zero', caption: 'India dares to make *nothing* into a number.' },
            { nodeId: 'decimal-system', caption: 'Place value turns ten symbols into infinity.' },
            { nodeId: 'arabic-numerals', caption: 'Scholars carry the digits west across the world.' },
            { nodeId: 'algebra', caption: 'Al-Khwarizmi builds an art of balancing the unknown.' },
            { nodeId: 'algorithm', caption: 'His name becomes the word for a recipe of pure logic.' },
            { nodeId: 'turing-machine', caption: 'Turing distills all computation to a single ideal device.' },
            { nodeId: 'computer', caption: 'From zero to the machine that runs the modern world.' },
        ],
    },
    {
        id: 'compass-to-newworld',
        question: 'How did a Chinese needle reveal a New World?',
        civilizationId: 'china',
        steps: [
            { nodeId: 'compass', caption: 'A magnetised needle in China learns to point the way.' },
            { nodeId: 'age-of-exploration', caption: 'Europe’s captains dare the open ocean.' },
            { nodeId: 'caravel', caption: 'Nimble caravels beat against the wind into the unknown.' },
            { nodeId: 'columbus', caption: 'In 1492, Columbus follows the needle across the Atlantic.' },
            { nodeId: 'new-world', caption: 'Two unknown continents rise from the sea.' },
            { nodeId: 'columbian-exchange', caption: 'The world’s crops, creatures, and peoples are forever mingled.' },
        ],
    },
    {
        id: 'paper-to-print',
        question: 'How did Chinese paper spark an information age?',
        civilizationId: 'china',
        steps: [
            { nodeId: 'paper', caption: 'Cai Lun presses pulp into cheap, abundant paper.' },
            { nodeId: 'printing', caption: 'Movable type lets a page be copied without a scribe.' },
            { nodeId: 'printing-press', caption: 'Gutenberg’s press multiplies ideas beyond any censor.' },
            { nodeId: 'humanism', caption: 'Cheap books rekindle the love of learning.' },
            { nodeId: 'renaissance', caption: 'A flood of knowledge helps light the Renaissance.' },
        ],
    },
    {
        id: 'greek-reason',
        question: 'How did ancient Greek reason survive into our age?',
        civilizationId: 'greece',
        steps: [
            { nodeId: 'aristotle', caption: 'Aristotle systematises logic and the study of nature.' },
            { nodeId: 'averroes', caption: 'In Córdoba, Averroes preserves and defends his works.' },
            { nodeId: 'humanism', caption: 'Europe rediscovers the ancients and trusts the mind again.' },
            { nodeId: 'renaissance', caption: 'That trust blossoms into the Renaissance.' },
            { nodeId: 'scientific-method', caption: 'Reason is forged into a method for questioning everything.' },
            { nodeId: 'modern-computing', caption: 'And logic, at last, is cast into thinking machines.' },
        ],
    },
    {
        id: 'gold-to-algorithm',
        question: 'How did West African gold travel from Mali to your calculator?',
        civilizationId: 'mali',
        steps: [
            { nodeId: 'mali', caption: 'Mansa Musa\'s Mali controls half the world\'s gold supply.' },
            { nodeId: 'trans-saharan-trade', caption: 'Camel caravans carry gold across the Sahara to the Islamic world.' },
            { nodeId: 'timbuktu', caption: 'Timbuktu becomes a city of libraries, scholars, and exchange.' },
            { nodeId: 'islamic-golden-age', caption: 'The House of Wisdom connects African gold to mathematical knowledge.' },
            { nodeId: 'algebra', caption: 'Al-Khwarizmi turns that knowledge into the language of the unknown.' },
            { nodeId: 'algorithm', caption: 'His name becomes the word for every recipe of logic.' },
            { nodeId: 'computer', caption: 'And algorithms run every calculator, phone, and AI in existence.' },
        ],
    },
    {
        id: 'rome-to-byzantium',
        question: 'How did Rome survive its own death for a thousand more years?',
        civilizationId: 'byzantine',
        steps: [
            { nodeId: 'rome', caption: 'The Western Roman Empire collapses in 476 AD — but the East endures.' },
            { nodeId: 'byzantine', caption: 'Constantinople carries Roman law, Greek philosophy, and Christian faith forward.' },
            { nodeId: 'justinian', caption: 'Justinian codifies all of Roman law into a single, enduring body.' },
            { nodeId: 'roman-law', caption: 'That code will underpin the legal systems of half the world.' },
            { nodeId: 'orthodox-christianity', caption: 'Byzantine Christianity spreads to Russia, Serbia, Bulgaria, and Greece.' },
            { nodeId: 'constantine', caption: 'Back at the beginning — the emperor who chose the city and the faith.' },
            { nodeId: 'renaissance', caption: 'When Constantinople falls in 1453, its scholars flee to Italy — and the Renaissance ignites.' },
        ],
    },
    {
        id: 'steppe-to-silk-road',
        question: 'How did Mongol horsemen briefly unite the whole world in trade?',
        civilizationId: 'mongol',
        steps: [
            { nodeId: 'mongol', caption: 'From the steppe, Genghis Khan\'s cavalry reshapes the map of the world.' },
            { nodeId: 'genghis-khan', caption: 'A genius of organised violence and political cunning unites the tribes.' },
            { nodeId: 'pax-mongolica', caption: 'In the brief peace that follows, a merchant can ride safely from China to Persia.' },
            { nodeId: 'silk-road', caption: 'The Silk Road reaches its greatest medieval peak of trade and exchange.' },
            { nodeId: 'paper', caption: 'Chinese paper and printing travel west along Mongol-secured roads.' },
            { nodeId: 'compass', caption: 'The compass travels too — toward the hands of European navigators.' },
            { nodeId: 'age-of-exploration', caption: 'The connected world the Mongols created plants the seed of ocean exploration.' },
        ],
    },
    {
        id: 'samurai-to-ai',
        question: 'How did Japan\'s warrior code find its way into artificial intelligence?',
        civilizationId: 'medieval-japan',
        steps: [
            { nodeId: 'medieval-japan', caption: 'Japan develops a culture of fierce discipline, precision, and strategic thinking.' },
            { nodeId: 'samurai', caption: 'The samurai warrior embodies mastery, strategy, and the art of winning.' },
            { nodeId: 'chess', caption: 'Strategy games — chess, shogi — become proving grounds for intelligence.' },
            { nodeId: 'zen-buddhism', caption: 'Zen\'s gift: concentrated, undistracted attention — the prerequisite of mastery.' },
            { nodeId: 'artificial-intelligence', caption: 'In 2016, AlphaGo masters Go — the most complex strategy game ever devised — defeating the world champion.' },
            { nodeId: 'neural-networks', caption: 'The deep learning systems that won at Go now power medicine, science, and art.' },
        ],
    },
    {
        id: 'longship-to-moon',
        question: 'How did Viking daring become the spirit of space exploration?',
        civilizationId: 'viking',
        steps: [
            { nodeId: 'viking', caption: 'Norse seafarers sail beyond the edge of the known world into open ocean.' },
            { nodeId: 'longship', caption: 'Their revolutionary ships make the impossible journey possible.' },
            { nodeId: 'leif-erikson', caption: 'Leif Erikson reaches North America — an entirely unknown continent.' },
            { nodeId: 'age-of-exploration', caption: 'Five centuries later, the European spirit of exploration reaches further still.' },
            { nodeId: 'aviation', caption: 'The sky itself becomes the new ocean to cross.' },
            { nodeId: 'rocket', caption: 'And then — beyond the sky.' },
            { nodeId: 'spaceflight', caption: 'Humanity steps onto the Moon: the ultimate expression of the daring to sail beyond.' },
        ],
    },
    {
        id: 'maya-zero-to-digital',
        question: 'How did the Maya\'s independent zero connect to the digital world?',
        civilizationId: 'maya',
        steps: [
            { nodeId: 'maya', caption: 'In the rainforests of Mesoamerica, Maya mathematicians independently invent zero.' },
            { nodeId: 'maya-mathematics', caption: 'A shell glyph represents nothing — and changes everything.' },
            { nodeId: 'zero', caption: 'Half a world away in India, zero is also born — and will travel further.' },
            { nodeId: 'decimal-system', caption: 'The positional decimal system makes all arithmetic universal.' },
            { nodeId: 'algebra', caption: 'Zero enables algebra: the manipulation of the unknown.' },
            { nodeId: 'binary', caption: 'Binary reduces all reality to two symbols — 0 and 1.' },
            { nodeId: 'computer', caption: 'And the computer, built from nothing and ones, runs the world.' },
        ],
    },
    {
        id: 'inca-engineering',
        question: 'How did the Inca build an empire without writing or wheels?',
        civilizationId: 'inca',
        steps: [
            { nodeId: 'inca', caption: 'High in the Andes, a small kingdom sets out to rule a continent.' },
            { nodeId: 'pachacuti', caption: 'Pachacuti, the World-Remaker, launches campaigns that build Tawantinsuyu in a single lifetime.' },
            { nodeId: 'inca-road', caption: 'Forty thousand kilometres of road cross the world\'s most formidable mountains.' },
            { nodeId: 'quipu', caption: 'Knotted strings carry the census, the tribute, and the memory of a people.' },
            { nodeId: 'terrace-farming', caption: 'Stone terraces turn impossible slopes into gardens feeding millions.' },
            { nodeId: 'machu-picchu', caption: 'And in the clouds above the Urubamba, a citadel of perfect stone rises — unseen for centuries.' },
            { nodeId: 'columbian-exchange', caption: 'Then the Spanish arrive, and the Inca crops — potato, tomato, maize — go on to feed the whole world.' },
        ],
    },
    {
        id: 'alphabet-to-internet',
        question: 'How did a Phoenician trader\'s script become the letters on your screen?',
        civilizationId: 'phoenicia',
        steps: [
            { nodeId: 'phoenicia', caption: 'Phoenician merchants need a quick, portable script to record trade across the Mediterranean.' },
            { nodeId: 'phoenician-alphabet', caption: '22 simple symbols — the first truly learnable writing system.' },
            { nodeId: 'greek-alphabet', caption: 'The Greeks add vowels and create the first perfect alphabet.' },
            { nodeId: 'latin', caption: 'Rome adopts the Greek script and spreads it across a continent.' },
            { nodeId: 'printing-press', caption: 'Gutenberg\'s press turns Latin letters into the first mass medium.' },
            { nodeId: 'binary', caption: 'Leibniz reduces all symbols to 0 and 1.' },
            { nodeId: 'internet', caption: 'Those 0s and 1s carry every letter, word, and idea in human history across the world.' },
        ],
    },
    {
        id: 'mughal-synthesis',
        question: 'How did the Mughal Empire become a crucible of world cultures?',
        civilizationId: 'mughal',
        steps: [
            { nodeId: 'mongol', caption: 'Babur carries Mongol and Timurid heritage across the Hindu Kush.' },
            { nodeId: 'babur', caption: 'His victory at Panipat founds a dynasty that will rule India for 330 years.' },
            { nodeId: 'akbar', caption: 'Akbar hosts debates between Muslims, Hindus, Jains, Parsis, and Christians — seeking a universal truth.' },
            { nodeId: 'religious-tolerance', caption: 'Tolerance becomes policy: a Hindu can rise to the highest office of an Islamic empire.' },
            { nodeId: 'mughal-art', caption: 'Persian, Indian, and European art traditions fuse into something entirely new.' },
            { nodeId: 'taj-mahal', caption: 'Shah Jahan builds the Taj Mahal — the most beautiful building in the world, in marble and grief.' },
            { nodeId: 'india', caption: 'The Mughal synthesis leaves India permanently richer, permanently more complex.' },
        ],
    },
    {
        id: 'korea-to-printing',
        question: 'How did Korea\'s innovations quietly reshape the information age?',
        civilizationId: 'korea',
        steps: [
            { nodeId: 'korea', caption: 'Squeezed between China and Japan, Korea forges its own intellectual tradition.' },
            { nodeId: 'korean-movable-type', caption: 'Two centuries before Gutenberg, Korean craftsmen cast metal type and print a Buddhist text.' },
            { nodeId: 'sejong-the-great', caption: 'King Sejong creates Hangul — the most rational alphabet ever designed — to make all Koreans literate.' },
            { nodeId: 'hangul', caption: 'A phonetically precise script learnable in days rather than years: education democratised.' },
            { nodeId: 'printing-press', caption: 'Meanwhile in Europe, Gutenberg\'s press triggers the Reformation and Scientific Revolution.' },
            { nodeId: 'information-theory', caption: 'Shannon proves that information, however encoded, obeys mathematical laws.' },
            { nodeId: 'internet', caption: 'Every writing system — Hangul, Latin, Arabic — now flows through the same digital network.' },
        ],
    },
];

export const STORY_MAP: Record<string, Story> = Object.fromEntries(
    STORIES.map((s) => [s.id, s])
);

/** Stories that begin in / belong to a given civilization. */
export function storiesForCivilization(civilizationId: string): Story[] {
    return STORIES.filter((s) => s.civilizationId === civilizationId);
}
