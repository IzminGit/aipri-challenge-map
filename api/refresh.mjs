import { refreshData } from "../tools/refresh-data.mjs";

const EVENT10_SEARCH_URL = "https://aipri.jp/event/search.html?event_id=10";

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const originalUrl = typeof input === "string" ? input : input?.url;
    if (!originalUrl) return originalFetch(input, init);

    const url = new URL(originalUrl);
    if (url.hostname === "aipri.jp" && url.pathname === "/event/result.html") {
      const eventIds = url.searchParams.getAll("event_id[]");
      if (eventIds.includes("9")) {
        url.searchParams.delete("event_id[]");
        url.searchParams.append("event_id[]", "10");
        input = url.toString();
      }
    }

    return originalFetch(input, init);
  };

  try {
    const data = await refreshData({ log: false, writeFiles: false });
    data.eventName = "お店でアイプリチャレンジ！";
    data.sourceUrl = EVENT10_SEARCH_URL;
    data.sourceUrls = data.sourceUrls.map((url) => url.replace(/event_id%5B%5D=9/g, "event_id%5B%5D=10"));
    data.challengeId = "event-10";
    data.eventId = "10";
    response.status(200).json(data);
  } catch (error) {
    response.status(500).json({
      error: "refresh_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}
