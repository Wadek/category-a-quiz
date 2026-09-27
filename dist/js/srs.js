/**
 * SM-2 spaced repetition (simplified Anki-style).
 * quality: 0 Again, 1 Hard, 2 Good, 3 Easy  (mapped to SM-2 1/3/4/5)
 */
(function (global) {
  const MAP = { 0: 1, 1: 3, 2: 4, 3: 5 };

  function defaultState(cardId) {
    return {
      id: cardId,
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
    const q = MAP[qualityBtn] ?? 3;
    const next = { ...state, history: [...(state.history || [])] };
    next.lastQuality = qualityBtn;
    next.lastReviewed = Date.now();
    next.history.push({ t: next.lastReviewed, q: qualityBtn });
    if (next.history.length > 50) next.history = next.history.slice(-50);

    if (q < 3) {
      next.repetitions = 0;
      next.interval = 0;
      next.due = Date.now() + 60 * 1000; // again in ~1 min
      next.lapses = (next.lapses || 0) + 1;
      next.ease = Math.max(1.3, (next.ease || 2.5) - 0.2);
      return next;
    }

    if (next.repetitions === 0) {
      next.interval = qualityBtn === 3 ? 4 : 1; // Easy jumps a bit
    } else if (next.repetitions === 1) {
      next.interval = qualityBtn === 3 ? 7 : (qualityBtn === 1 ? 3 : 6);
    } else {
      const ease = next.ease || 2.5;
      let interval = Math.round(next.interval * ease);
      if (qualityBtn === 1) interval = Math.max(1, Math.round(interval * 0.85));
      if (qualityBtn === 3) interval = Math.round(interval * 1.3);
      next.interval = Math.max(1, interval);
    }

    next.repetitions = (next.repetitions || 0) + 1;
    // ease update (SM-2)
    next.ease = Math.max(
      1.3,
      (next.ease || 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );
    next.due = Date.now() + next.interval * 24 * 60 * 60 * 1000;
    return next;
  }

  function isDue(state, now = Date.now()) {
    return !state || (state.due || 0) <= now;
  }

  global.SRS = { defaultState, review, isDue, MAP };
})(typeof window !== 'undefined' ? window : globalThis);
