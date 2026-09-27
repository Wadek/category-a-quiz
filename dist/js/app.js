/* Category A Finland Motorcycle Quiz — main UI */
(function () {
  const TOPIC_LABELS = {
    signs: 'Traffic signs',
    right_of_way: 'Right of way',
    speed: 'Speed limits',
    equipment: 'Equipment & PPE',
    alcohol: 'Alcohol & impairment',
    lights: 'Lights',
    passengers: 'Passengers & loads',
    winter: 'Winter & conditions',
    highways: 'Highways',
    licence: 'Licence & exam',
    visibility: 'Visibility',
    mechanics: 'Mechanics',
    other_users: 'Other road users',
    risk: 'Risk awareness'
  };

  let deck = [];
  let srsMap = {};
  let settings = Store.loadSettings();
  let sessionQueue = [];
  let current = null;
  let answered = false;

  const $ = (sel) => document.querySelector(sel);
  const panels = {
    study: $('#panel-study'),
    dash: $('#panel-dash'),
    topics: $('#panel-topics')
  };

  async function init() {
    const res = await fetch('./data/cards.json');
    const data = await res.json();
    deck = data.cards;
    srsMap = Store.loadSrs();
    for (const c of deck) Store.getCardState(srsMap, c.id);
    Store.saveSrs(srsMap);

    fillTopicSelects();
    bindNav();
    bindStudy();
    bindDash();
    updateDueBadge();
    refreshDashboard();
    startSession();

    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (e) {
        console.warn('SW register failed', e);
      }
    }
  }

  function fillTopicSelects() {
    const topics = [...new Set(deck.map((c) => c.topic))].sort();
    for (const sel of ['#topic-filter', '#drill-topic']) {
      const el = $(sel);
      if (!el) continue;
      const keepFirst = el.querySelector('option');
      el.innerHTML = '';
      if (sel === '#topic-filter') {
        el.appendChild(new Option('All topics', 'all'));
      } else {
        el.appendChild(new Option('Choose topic…', ''));
      }
      for (const t of topics) {
        el.appendChild(new Option(TOPIC_LABELS[t] || t, t));
      }
    }
    $('#topic-filter').value = settings.topicFilter || 'all';
  }

  function bindNav() {
    document.querySelectorAll('nav.tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const name = btn.dataset.panel;
        Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === name));
        if (name === 'dash') refreshDashboard();
        if (name === 'topics') refreshTopicsPanel();
      });
    });
  }

  function dueCards(filterTopic) {
    const now = Date.now();
    return deck.filter((c) => {
      if (filterTopic && filterTopic !== 'all' && c.topic !== filterTopic) return false;
      return SRS.isDue(srsMap[c.id], now);
    });
  }

  function newishCards(filterTopic) {
    return deck.filter((c) => {
      if (filterTopic && filterTopic !== 'all' && c.topic !== filterTopic) return false;
      const st = srsMap[c.id];
      return !st.lastReviewed;
    });
  }

  function buildQueue(opts = {}) {
    const topic = opts.topic || settings.topicFilter || 'all';
    const due = dueCards(topic);
    // Prefer due reviews; sprinkle unseen up to dailyNew
    const unseen = newishCards(topic).filter((c) => due.indexOf(c) === -1);
    const cap = settings.dailyNew ?? 20;
    const pickNew = unseen.sort(() => Math.random() - 0.5).slice(0, cap);
    const queue = [...due.sort(() => Math.random() - 0.5), ...pickNew];
    // If empty, allow extras from topic for drill
    if (!queue.length && opts.forceTopic) {
      return deck.filter((c) => c.topic === opts.forceTopic).sort(() => Math.random() - 0.5);
    }
    if (!queue.length) {
      return deck.filter((c) => topic === 'all' || c.topic === topic).sort(() => Math.random() - 0.5).slice(0, 10);
    }
    return queue;
  }

  function startSession(opts) {
    sessionQueue = buildQueue(opts || {});
    answered = false;
    current = null;
    nextCard();
    updateDueBadge();
  }

  function nextCard() {
    answered = false;
    current = sessionQueue.shift() || null;
    const root = $('#study-root');
    if (!current) {
      root.innerHTML = `<div class="empty card">
        <p><strong>Caught up for now.</strong></p>
        <p>No more due cards in this filter. Open Dashboard or start a topic drill.</p>
        <div class="btn-row">
          <button class="primary" id="btn-more">Study 10 more</button>
        </div>
      </div>`;
      $('#btn-more')?.addEventListener('click', () => {
        sessionQueue = deck
          .filter((c) => settings.topicFilter === 'all' || c.topic === settings.topicFilter)
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        nextCard();
      });
      updateDueBadge();
      return;
    }
    renderCard(current);
  }

  function renderCard(card) {
    const root = $('#study-root');
    const topic = TOPIC_LABELS[card.topic] || card.topic;
    let body = '';
    if (card.type === 'mc') {
      body = `<div class="options">${card.options
        .map(
          (o, i) =>
            `<button class="option" data-i="${i}"><strong>${String.fromCharCode(65 + i)}.</strong> ${escapeHtml(o)}</button>`
        )
        .join('')}</div>`;
    } else {
      body = `<div class="tf-row">
        <button class="tf-btn" data-tf="true">True</button>
        <button class="tf-btn" data-tf="false">False</button>
      </div>`;
    }
    root.innerHTML = `<div class="card">
      <div class="topic-pill">${escapeHtml(topic)} · ${card.type === 'mc' ? 'Multiple choice' : 'True / False'}</div>
      <p class="question">${escapeHtml(card.question)}</p>
      ${body}
      <div id="after" hidden></div>
    </div>`;

    if (card.type === 'mc') {
      root.querySelectorAll('.option').forEach((btn) => {
        btn.addEventListener('click', () => onAnswer(Number(btn.dataset.i)));
      });
    } else {
      root.querySelectorAll('.tf-btn').forEach((btn) => {
        btn.addEventListener('click', () => onAnswer(btn.dataset.tf === 'true'));
      });
    }
  }

  function onAnswer(value) {
    if (answered || !current) return;
    answered = true;
    const card = current;
    let correct;
    if (card.type === 'mc') {
      correct = value === card.answer;
      rootDisableOptions(value, card.answer);
    } else {
      correct = value === card.answer;
      rootDisableTf(value, card.answer);
    }
    const after = $('#after');
    after.hidden = false;
    after.innerHTML = `
      <div class="explanation">
        <div class="result-line ${correct ? 'ok' : 'bad'}">${correct ? 'Correct' : 'Not quite'}</div>
        <div>${escapeHtml(card.explanation)}</div>
        <div class="src">Source theme: ${escapeHtml(card.source)}</div>
      </div>
      <div class="ratings">
        <button class="again" data-q="0">Again<small>~1 min</small></button>
        <button class="hard" data-q="1">Hard<small>short</small></button>
        <button class="good" data-q="2">Good<small>SM-2</small></button>
        <button class="easy" data-q="3">Easy<small>longer</small></button>
      </div>`;
    after.querySelectorAll('.ratings button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = Number(btn.dataset.q);
        // If wrong and user hits Good/Easy, still allow but Again is suggested — no hard block
        const st = Store.getCardState(srsMap, card.id);
        srsMap[card.id] = SRS.review(st, q);
        Store.saveSrs(srsMap);
        updateDueBadge();
        nextCard();
      });
    });
  }

  function rootDisableOptions(chosen, answer) {
    document.querySelectorAll('.option').forEach((btn) => {
      const i = Number(btn.dataset.i);
      btn.disabled = true;
      if (i === answer) btn.classList.add('correct');
      if (i === chosen && chosen !== answer) btn.classList.add('wrong');
    });
  }

  function rootDisableTf(chosen, answer) {
    document.querySelectorAll('.tf-btn').forEach((btn) => {
      btn.disabled = true;
      const v = btn.dataset.tf === 'true';
      if (v === answer) btn.classList.add('correct');
      if (v === chosen && chosen !== answer) btn.classList.add('wrong');
    });
  }

  function bindStudy() {
    $('#topic-filter')?.addEventListener('change', (e) => {
      settings.topicFilter = e.target.value;
      Store.saveSettings(settings);
      startSession();
    });
  }

  function updateDueBadge() {
    const n = dueCards(settings.topicFilter || 'all').length;
    const el = $('#due-badge');
    if (el) el.textContent = `${n} due`;
  }

  function retentionStats() {
    let reviewed = 0, young = 0, mature = 0, lapses = 0;
    const now = Date.now();
    for (const c of deck) {
      const st = srsMap[c.id];
      if (!st?.lastReviewed) continue;
      reviewed++;
      lapses += st.lapses || 0;
      if ((st.interval || 0) >= 21) mature++;
      else young++;
    }
    const due = dueCards('all').length;
    const retention = reviewed ? Math.round((1 - Math.min(1, lapses / (reviewed * 3))) * 100) : 0;
    return { total: deck.length, reviewed, young, mature, due, retention, unseen: deck.length - reviewed };
  }

  function weakTopics() {
    const by = {};
    for (const c of deck) {
      const st = srsMap[c.id];
      if (!by[c.topic]) by[c.topic] = { topic: c.topic, reviews: 0, lapses: 0, easeSum: 0, n: 0 };
      by[c.topic].n++;
      if (st?.lastReviewed) {
        by[c.topic].reviews++;
        by[c.topic].lapses += st.lapses || 0;
        by[c.topic].easeSum += st.ease || 2.5;
      }
    }
    return Object.values(by)
      .map((t) => {
        const ease = t.reviews ? t.easeSum / t.reviews : 2.5;
        const lapseRate = t.reviews ? t.lapses / t.reviews : 0;
        const score = lapseRate * 2 + (2.5 - ease);
        return { ...t, ease, lapseRate, score, label: TOPIC_LABELS[t.topic] || t.topic };
      })
      .sort((a, b) => b.score - a.score);
  }

  function refreshDashboard() {
    const s = retentionStats();
    $('#dash-stats').innerHTML = `
      <div class="stats-grid">
        <div class="stat"><div class="n">${s.due}</div><div class="l">Due today</div></div>
        <div class="stat"><div class="n">${s.retention}%</div><div class="l">Retention index</div></div>
        <div class="stat"><div class="n">${s.reviewed}</div><div class="l">Cards seen</div></div>
        <div class="stat"><div class="n">${s.mature}</div><div class="l">Mature (≥21d)</div></div>
      </div>
      <p style="margin:12px 0 4px;font-size:.85rem;color:var(--muted)">Progress ${s.reviewed}/${s.total}</p>
      <div class="progress-bar"><span style="width:${Math.round((s.reviewed / s.total) * 100)}%"></span></div>
    `;
    const weak = weakTopics().slice(0, 5);
    $('#dash-weak').innerHTML = weak
      .map((t) => {
        const cls = t.lapseRate > 0.4 ? 'weak' : t.lapseRate > 0.15 ? 'okish' : 'strong';
        return `<div class="topic-row"><span>${escapeHtml(t.label)}</span>
          <span class="${cls}">${t.reviews ? `ease ${t.ease.toFixed(2)} · lapses ${t.lapses}` : 'not started'}</span></div>`;
      })
      .join('');
  }

  function refreshTopicsPanel() {
    const weak = weakTopics();
    $('#topic-list').innerHTML = weak
      .map(
        (t) => `<div class="topic-row">
        <span>${escapeHtml(t.label)} <small style="color:var(--muted)">(${t.n})</small></span>
        <button class="ghost" data-drill="${t.topic}">Drill</button>
      </div>`
      )
      .join('');
    $('#topic-list').querySelectorAll('[data-drill]').forEach((btn) => {
      btn.addEventListener('click', () => startDrill(btn.dataset.drill));
    });
  }

  function startDrill(topic) {
    settings.topicFilter = topic;
    Store.saveSettings(settings);
    $('#topic-filter').value = topic;
    document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.panel === 'study'));
    Object.entries(panels).forEach(([k, el]) => el.classList.toggle('active', k === 'study'));
    startSession({ topic, forceTopic: topic });
  }

  function bindDash() {
    $('#btn-reset')?.addEventListener('click', () => {
      if (confirm('Reset all spaced-repetition progress on this device?')) {
        Store.resetAll();
        srsMap = {};
        for (const c of deck) Store.getCardState(srsMap, c.id);
        Store.saveSrs(srsMap);
        startSession();
        refreshDashboard();
      }
    });
    $('#btn-install-help')?.addEventListener('click', () => {
      alert('To install as a PWA: open this site in Chrome/Edge/Safari, then use browser menu → Install app / Add to Home Screen.');
    });
    $('#start-drill')?.addEventListener('click', () => {
      const t = $('#drill-topic').value;
      if (t) startDrill(t);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose for debugging
  window.CatAQuiz = { startSession, startDrill, dueCards, retentionStats, weakTopics };

  init().catch((e) => {
    $('#study-root').innerHTML = `<div class="card empty">Failed to load cards: ${escapeHtml(e.message)}</div>`;
  });
})();
