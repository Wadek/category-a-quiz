import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CARDS_PATH = path.join(ROOT, 'data', 'cards.json');
const STATE_PATH = process.env.CAT_A_QUIZ_STATE
  ? path.resolve(process.env.CAT_A_QUIZ_STATE)
  : path.join(ROOT, 'mcp', 'state', 'srs.json');

const QUALITY_MAP = { 0: 1, 1: 3, 2: 4, 3: 5 }; // Again/Hard/Good/Easy -> SM-2

function defaultState(id) {
  return {
    id,
    repetitions: 0,
    ease: 2.5,
    interval: 0,
    due: Date.now(),
    lapses: 0,
    lastQuality: null,
    lastReviewed: null,
    history: []
  };
}

function review(state, qualityBtn) {
  const q = QUALITY_MAP[qualityBtn] ?? 3;
  const next = { ...state, history: [...(state.history || [])] };
  next.lastQuality = qualityBtn;
  next.lastReviewed = Date.now();
  next.history.push({ t: next.lastReviewed, q: qualityBtn });
  if (next.history.length > 50) next.history = next.history.slice(-50);

  if (q < 3) {
    next.repetitions = 0;
    next.interval = 0;
    next.due = Date.now() + 60 * 1000;
    next.lapses = (next.lapses || 0) + 1;
    next.ease = Math.max(1.3, (next.ease || 2.5) - 0.2);
    return next;
  }

  if (next.repetitions === 0) {
    next.interval = qualityBtn === 3 ? 4 : 1;
  } else if (next.repetitions === 1) {
    next.interval = qualityBtn === 3 ? 7 : qualityBtn === 1 ? 3 : 6;
  } else {
    const ease = next.ease || 2.5;
    let interval = Math.round(next.interval * ease);
    if (qualityBtn === 1) interval = Math.max(1, Math.round(interval * 0.85));
    if (qualityBtn === 3) interval = Math.round(interval * 1.3);
    next.interval = Math.max(1, interval);
  }

  next.repetitions = (next.repetitions || 0) + 1;
  next.ease = Math.max(
    1.3,
    (next.ease || 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );
  next.due = Date.now() + next.interval * 24 * 60 * 60 * 1000;
  return next;
}

function loadJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export async function createQuizEngine() {
  const deckData = loadJson(CARDS_PATH, null);
  if (!deckData?.cards?.length) {
    throw new Error(`No cards found at ${CARDS_PATH}`);
  }
  const cards = deckData.cards;
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

  let stateDoc = loadJson(STATE_PATH, { version: 1, cards: {}, drillQueue: [], session: null });
  if (!stateDoc.cards) stateDoc.cards = {};
  for (const c of cards) {
    if (!stateDoc.cards[c.id]) stateDoc.cards[c.id] = defaultState(c.id);
  }
  persist();

  function persist() {
    saveJson(STATE_PATH, stateDoc);
  }

  function dueList(topic) {
    const now = Date.now();
    return cards.filter((c) => {
      if (topic && topic !== 'all' && c.topic !== topic) return false;
      return (stateDoc.cards[c.id]?.due || 0) <= now;
    });
  }

  function dueCount(topic = 'all') {
    const list = dueList(topic);
    const byTopic = {};
    for (const c of list) byTopic[c.topic] = (byTopic[c.topic] || 0) + 1;
    return {
      due: list.length,
      topic: topic || 'all',
      byTopic,
      totalCards: cards.length,
      statePath: STATE_PATH
    };
  }

  function publicCard(card, hideAnswer = true) {
    const base = {
      id: card.id,
      type: card.type,
      topic: card.topic,
      question: card.question,
      source: card.source
    };
    if (card.type === 'mc') base.options = card.options;
    if (!hideAnswer) {
      base.answer = card.answer;
      base.explanation = card.explanation;
    }
    return base;
  }

  function nextCard({ topic } = {}) {
    // Prefer drill queue
    while (stateDoc.drillQueue?.length) {
      const id = stateDoc.drillQueue.shift();
      const card = byId[id];
      if (card) {
        stateDoc.session = { cardId: id, shownAt: Date.now() };
        persist();
        return { card: publicCard(card, true), source: 'drill', remainingDrill: stateDoc.drillQueue.length };
      }
    }

    const due = dueList(topic || 'all');
    let card = due[Math.floor(Math.random() * due.length)];
    if (!card) {
      const pool = cards.filter((c) => !topic || topic === 'all' || c.topic === topic);
      card = pool[Math.floor(Math.random() * pool.length)];
    }
    if (!card) return { card: null, message: 'No cards available' };
    stateDoc.session = { cardId: card.id, shownAt: Date.now() };
    persist();
    return {
      card: publicCard(card, true),
      source: (stateDoc.cards[card.id].due || 0) <= Date.now() ? 'due' : 'practice',
      dueRemaining: Math.max(0, dueList(topic || 'all').length - 1)
    };
  }

  function answer({ cardId, rating, chosen }) {
    const id = cardId || stateDoc.session?.cardId;
    if (!id || !byId[id]) return { ok: false, error: 'Unknown or missing cardId' };
    const q = Number(rating);
    if (![0, 1, 2, 3].includes(q)) {
      return { ok: false, error: 'rating must be 0=Again, 1=Hard, 2=Good, 3=Easy' };
    }
    const card = byId[id];
    let correct = null;
    if (chosen !== undefined && chosen !== null) {
      if (card.type === 'mc') correct = Number(chosen) === card.answer;
      else correct = Boolean(chosen) === Boolean(card.answer);
    }
    stateDoc.cards[id] = review(stateDoc.cards[id] || defaultState(id), q);
    stateDoc.session = null;
    persist();
    return {
      ok: true,
      cardId: id,
      rating: q,
      correct,
      explanation: card.explanation,
      answer: card.answer,
      options: card.options,
      srs: {
        ease: stateDoc.cards[id].ease,
        intervalDays: stateDoc.cards[id].interval,
        due: new Date(stateDoc.cards[id].due).toISOString(),
        repetitions: stateDoc.cards[id].repetitions,
        lapses: stateDoc.cards[id].lapses
      }
    };
  }

  function stats() {
    let reviewed = 0, mature = 0, young = 0, lapses = 0;
    const byTopic = {};
    for (const c of cards) {
      const st = stateDoc.cards[c.id];
      if (!byTopic[c.topic]) byTopic[c.topic] = { n: 0, reviewed: 0, lapses: 0, easeSum: 0 };
      byTopic[c.topic].n++;
      if (st?.lastReviewed) {
        reviewed++;
        lapses += st.lapses || 0;
        byTopic[c.topic].reviewed++;
        byTopic[c.topic].lapses += st.lapses || 0;
        byTopic[c.topic].easeSum += st.ease || 2.5;
        if ((st.interval || 0) >= 21) mature++;
        else young++;
      }
    }
    const weakTopics = Object.entries(byTopic)
      .map(([topic, t]) => {
        const ease = t.reviewed ? t.easeSum / t.reviewed : 2.5;
        const lapseRate = t.reviewed ? t.lapses / t.reviewed : 0;
        return { topic, ...t, ease, lapseRate, score: lapseRate * 2 + (2.5 - ease) };
      })
      .sort((a, b) => b.score - a.score);

    const retention = reviewed ? Math.round((1 - Math.min(1, lapses / (reviewed * 3))) * 100) : 0;
    return {
      totalCards: cards.length,
      dueToday: dueList('all').length,
      reviewed,
      unseen: cards.length - reviewed,
      mature,
      young,
      retentionIndex: retention,
      weakTopics: weakTopics.slice(0, 8),
      drillQueueLength: stateDoc.drillQueue?.length || 0,
      statePath: STATE_PATH,
      topics: deckData.topics || [...new Set(cards.map((c) => c.topic))]
    };
  }

  function addTopicDrill({ topic, limit = 15 } = {}) {
    if (!topic) return { ok: false, error: 'topic is required' };
    const pool = cards.filter((c) => c.topic === topic);
    if (!pool.length) {
      return {
        ok: false,
        error: `Unknown topic '${topic}'`,
        available: [...new Set(cards.map((c) => c.topic))].sort()
      };
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(1, Number(limit) || 15));
    stateDoc.drillQueue = [...(stateDoc.drillQueue || []), ...shuffled.map((c) => c.id)];
    persist();
    return {
      ok: true,
      topic,
      added: shuffled.length,
      queueLength: stateDoc.drillQueue.length,
      sampleQuestions: shuffled.slice(0, 3).map((c) => c.question)
    };
  }

  return { dueCount, nextCard, answer, stats, addTopicDrill, ROOT, STATE_PATH, CARDS_PATH };
}
