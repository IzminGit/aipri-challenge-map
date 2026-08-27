(() => {
  const DEFAULT_MONTH = "2026-09";
  const monthKey = `month:${DEFAULT_MONTH}`;

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof appState === "undefined" || typeof eventMatches === "undefined") return;

    const hasSeptember = appState.data?.shops?.some((shop) =>
      shop.events?.some((event) => event.date?.startsWith(`${DEFAULT_MONTH}-`)),
    );
    if (!hasSeptember) return;

    const originalEventMatches = eventMatches;
    eventMatches = (event) => {
      if (appState.date === monthKey) {
        if (!event.date?.startsWith(`${DEFAULT_MONTH}-`)) return false;
        if (appState.age !== "all" && event.ageLimit !== appState.age) return false;
        return timeMatches(event.registrationTime || event.startTime);
      }
      return originalEventMatches(event);
    };

    let button = document.querySelector(`#dateFilter [data-date="${monthKey}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.date = monthKey;
      button.textContent = "9月";
      document.querySelector("#dateFilter")?.insertBefore(button, document.querySelector("#dateFilter")?.children[1] || null);
    }

    appState.date = monthKey;
    document.querySelectorAll("#dateFilter [data-date]").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    render();
  });
})();
