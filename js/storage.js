(function (global) {
  const KEY = 'catAQuiz.srs.v1';
  const SETTINGS = 'catAQuiz.settings.v1';

  function loadSrs() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveSrs(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
  }

  function getCardState(map, id) {
    if (!map[id]) map[id] = SRS.defaultState(id);
    return map[id];
  }

  function loadSettings() {
    try {
      return Object.assign(
        { topicFilter: 'all', dailyNew: 20 },
        JSON.parse(localStorage.getItem(SETTINGS) || '{}')
      );
    } catch {
      return { topicFilter: 'all', dailyNew: 20 };
    }
  }

  function saveSettings(s) {
    localStorage.setItem(SETTINGS, JSON.stringify(s));
  }

  function resetAll() {
    localStorage.removeItem(KEY);
  }

  global.Store = { loadSrs, saveSrs, getCardState, loadSettings, saveSettings, resetAll, KEY };
})(typeof window !== 'undefined' ? window : globalThis);
