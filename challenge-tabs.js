(() => {
  const CURRENT_KEY = "aipri-challenge-current-v2";
  const MODE_KEY = "aipri-challenge-mode-v2";
  const FETCHED_KEY = "aipri-challenge-fetched-v2";
  const CURRENT_MODE = "current";
  const PAST_MODE = "past";
  const DEFAULT_MONTH = "2026-09";

  const legacyData = window.AIPRI_EVENT_DATA;
  const cachedCurrent = readJson(sessionStorage.getItem(CURRENT_KEY));
  const mode = sessionStorage.getItem(MODE_KEY) || CURRENT_MODE;

  if (mode === CURRENT_MODE && cachedCurrent?.shops?.length) {
    window.AIPRI_EVENT_DATA = cachedCurrent;
  } else if (mode === PAST_MODE) {
    window.AIPRI_EVENT_DATA = legacyData;
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectStyles();
    injectTabs();
    setupDefaultMonthFilter();

    if (mode === CURRENT_MODE && !cachedCurrent?.shops?.length && !sessionStorage.getItem(FETCHED_KEY)) {
      sessionStorage.setItem(FETCHED_KEY, "1");
      fetch("/api/refresh?event_id=10", { method: "GET" })
        .then((response) => {
          if (!response.ok) throw new Error(`refresh failed: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (!data?.shops?.length) throw new Error("event data is empty");
          sessionStorage.setItem(CURRENT_KEY, JSON.stringify(data));
          location.reload();
        })
        .catch(() => {
          sessionStorage.removeItem(FETCHED_KEY);
          document.querySelector("#challengeRefreshHint")?.remove();
        });
    }
  });

  function setupDefaultMonthFilter() {
    if (mode !== CURRENT_MODE || !window.appState && typeof appState === "undefined") return;
    const filter = document.querySelector("#dateFilter");
    if (!filter) return;

    const hasSeptember = appState.data?.shops?.some((shop) =>
      shop.events?.some((event) => event.date?.startsWith(`${DEFAULT_MONTH}-`)),
    );
    if (!hasSeptember) return;

    let button = filter.querySelector(`[data-date="month:${DEFAULT_MONTH}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.date = `month:${DEFAULT_MONTH}`;
      button.textContent = "9月";
      filter.insertBefore(button, filter.firstElementChild?.nextElementSibling || null);
    }

    appState.date = `month:${DEFAULT_MONTH}`;
    filter.querySelectorAll("[data-date]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    render();
  }

  function injectTabs() {
    if (document.querySelector("#challengeTabs")) return;
    const header = document.querySelector(".topbar");
    if (!header) return;

    const nav = document.createElement("nav");
    nav.id = "challengeTabs";
    nav.className = "challenge-tabs";
    nav.setAttribute("aria-label", "アイプリチャレンジ開催分切替");
    nav.innerHTML = `
      <button type="button" class="challenge-tab ${mode === CURRENT_MODE ? "is-active" : ""}" data-challenge-mode="current">
        開催中・今後
      </button>
      <button type="button" class="challenge-tab ${mode === PAST_MODE ? "is-active" : ""}" data-challenge-mode="past">
        過去開催分
      </button>
    `;

    header.insertAdjacentElement("afterend", nav);
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-challenge-mode]");
      if (!button) return;
      const nextMode = button.dataset.challengeMode;
      sessionStorage.setItem(MODE_KEY, nextMode);
      location.reload();
    });
  }

  function injectStyles() {
    if (document.querySelector("#challengeTabsStyles")) return;
    const style = document.createElement("style");
    style.id = "challengeTabsStyles";
    style.textContent = `
      .challenge-tabs {
        display: flex;
        gap: 8px;
        padding: 12px clamp(16px, 4vw, 32px) 0;
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e8e8ee);
      }
      .challenge-tab {
        appearance: none;
        border: 1px solid var(--border, #dedee8);
        border-bottom: 0;
        background: var(--surface-muted, #f7f7fb);
        color: var(--text-muted, #666);
        border-radius: 12px 12px 0 0;
        padding: 10px 18px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .challenge-tab.is-active {
        background: var(--surface, #fff);
        color: var(--accent, #e94d9a);
        box-shadow: 0 -2px 0 var(--accent, #e94d9a) inset;
      }
      @media (max-width: 640px) {
        .challenge-tabs { padding-inline: 12px; }
        .challenge-tab { flex: 1; padding: 10px 8px; font-size: 13px; }
      }
    `;
    document.head.appendChild(style);
  }

  function readJson(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
})();
