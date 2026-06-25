import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SEARCH_URL = "https://aipri.jp/event/search.html?event_id=9";
const RESULT_URL_BASE = "https://aipri.jp/event/result.html";
const PREFECTURES = [
  { id: "21", name: "岐阜県" },
  { id: "23", name: "愛知県" },
  { id: "24", name: "三重県" },
];

const numerals = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
const entityMap = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
};

const addressOverrides = new Map([
  ["GiGO イオンタウン名西", "愛知県名古屋市西区香呑町6-49-1"],
  ["NICOPA なるぱーく店", "愛知県名古屋市緑区浦里三丁目232"],
  ["アニメガ×ソフマップ名古屋駅西店", "愛知県名古屋市中村区椿町6-9"],
  ["モーリーファンタジーワンダーシティ店", "愛知県名古屋市西区二方町40"],
  ["バンダイナムコ Cross Store 名古屋", "愛知県名古屋市西区二方町40"],
  ["モーリーファンタジー豊川開運通店", "愛知県豊川市開運通2-31"],
  ["モーリーファンタジー土岐店", "岐阜県土岐市土岐津町土岐口1372-1"],
]);

export async function refreshData({ log = true, writeFiles = true } = {}) {
  const shops = [];

  for (const prefecture of PREFECTURES) {
    const firstPage = await fetchOfficialPage(prefecture, 1);
    const pageCount = getPageCount(firstPage);
    const htmlPages = [firstPage];

    for (let page = 2; page <= pageCount; page += 1) {
      htmlPages.push(await fetchOfficialPage(prefecture, page));
    }

    const prefectureShops = htmlPages
      .flatMap((html) => extractShopBlocks(html))
      .map((block) => parseShop(block, prefecture, shops.length))
      .filter((shop) => shop.name && shop.address && shop.events.length);

    shops.push(...prefectureShops);
  }

  reassignIds(shops);

  const data = {
    eventName: "お店でアイプリコンテスト「バルーンフェスコーデ」をゲット！",
    prefecture: "岐阜県・愛知県・三重県",
    prefectures: PREFECTURES.map((prefecture) => prefecture.name),
    sourceUrl: SEARCH_URL,
    sourceUrls: PREFECTURES.map((prefecture) => buildResultUrl(prefecture, 1)),
    fetchedAt: new Date().toISOString(),
    shops,
  };

  await attachLocations(data, log, { writeCache: writeFiles });
  data.generatedAt = new Date().toISOString();

  if (writeFiles) {
    await fs.writeFile(path.join(ROOT_DIR, "aichi-events.json"), `${JSON.stringify(data, null, 2)}\n`);
    await fs.writeFile(
      path.join(ROOT_DIR, "data.js"),
      `window.AIPRI_EVENT_DATA = ${JSON.stringify(data, null, 2)};\n`,
    );
  }

  if (log) {
    const eventCount = shops.reduce((sum, shop) => sum + shop.events.length, 0);
    console.log(`Updated ${shops.length} shops / ${eventCount} events`);
  }

  return data;
}

async function fetchOfficialPage(prefecture, page) {
  const response = await fetch(buildResultUrl(prefecture, page), {
    headers: {
      "User-Agent": "CodexAipriContestMapPrototype/1.0",
      Accept: "text/html",
    },
  });
  if (!response.ok) {
    throw new Error(`Official page failed: ${prefecture.name} page ${page}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function buildResultUrl(prefecture, page) {
  const url = new URL(RESULT_URL_BASE);
  url.searchParams.append("event_id[]", "9");
  url.searchParams.set("key_word", "");
  url.searchParams.set("pref_id", prefecture.id);
  url.searchParams.set("event_year", "");
  url.searchParams.set("event_month", "");
  url.searchParams.set("event_date", "");
  url.searchParams.append("shop_flag[]", "1");
  url.searchParams.set("page", String(page));
  return url.toString();
}

function getPageCount(html) {
  const match = html.match(/pageLink__count">(?:\d+)\/(\d+)</);
  return match ? Number(match[1]) : 1;
}

function extractShopBlocks(html) {
  return html
    .split('<div class="shopResult__item">')
    .slice(1)
    .map((block) => block.split('<div class="pageLink">')[0]);
}

function parseShop(block, prefecture, index) {
  const name = firstMatch(block, /<h3 class="ttl ttl--shopResult">([\s\S]*?)<\/h3>/);
  const address = firstMatch(block, /<p class="shopResult__address">([\s\S]*?)<\/p>/);
  const mapsSearchUrl = attrMatch(block, /<a href="([^"]*google\.com\/maps\/search[^"]*)"/);
  const fields = parseDlFields(block);
  const partsByField = {
    date: splitParts(fields["開催日程"]),
    age: splitParts(fields["年齢制限"]),
    startTime: splitParts(fields["開催時間"]),
    registrationTime: splitParts(fields["参加受付時間"]),
    lotteryTime: splitParts(fields["抽選開始時間"]),
    note: splitParts(fields["備考"]),
  };
  const count = Math.max(1, ...Object.values(partsByField).map((parts) => parts.length));
  const events = Array.from({ length: count }, (_, eventIndex) => {
    const dateDisplay = getPartValue(partsByField.date, eventIndex, count);
    const label =
      partsByField.date[eventIndex]?.label ||
      partsByField.age[eventIndex]?.label ||
      (count > 1 ? `大会${numerals[eventIndex] ?? eventIndex + 1}` : "大会");

    return {
      id: `shop-${index + 1}-event-${eventIndex + 1}`,
      label,
      date: parseDate(dateDisplay),
      dateDisplay,
      ageLimit: getPartValue(partsByField.age, eventIndex, count),
      startTime: getPartValue(partsByField.startTime, eventIndex, count),
      registrationTime: getPartValue(partsByField.registrationTime, eventIndex, count),
      lotteryTime: getPartValue(partsByField.lotteryTime, eventIndex, count),
      note: getPartValue(partsByField.note, eventIndex, count),
    };
  });

  const machineTypes = [
    ["himitsu", "おねがいアイプリ"],
    ["verse", "アイプリバース"],
    ["hiroba", "アイプリステーション"],
  ]
    .filter(([type]) => block.includes(`shopResultType__img--${type}`))
    .map(([, label]) => label);

  return {
    id: `shop-${index + 1}`,
    name,
    address,
    prefecture: prefecture.name,
    machineTypes,
    participation: fields["参加方法"] ?? "",
    mapsSearchUrl,
    events,
  };
}

function reassignIds(shops) {
  shops.forEach((shop, shopIndex) => {
    shop.id = `shop-${shopIndex + 1}`;
    shop.events.forEach((event, eventIndex) => {
      event.id = `${shop.id}-event-${eventIndex + 1}`;
    });
  });
}

function parseDlFields(block) {
  const fields = {};
  const regex =
    /<dt class="searchedList__term">([\s\S]*?)<\/dt>\s*<dd class="searchedList__desc">([\s\S]*?)<\/dd>/g;
  for (const match of block.matchAll(regex)) {
    fields[htmlToText(match[1])] = htmlToText(match[2]);
  }
  return fields;
}

function splitParts(value) {
  if (!value) return [];
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^大会\s*([①②③④⑤⑥⑦⑧⑨⑩]|\d+)\s*(.*)$/);
      if (!match) return { label: "", value: line };
      const raw = match[1];
      const index = /^\d+$/.test(raw) ? Number(raw) : numerals.indexOf(raw) + 1;
      return { label: `大会${numerals[index - 1] ?? index}`, value: match[2].trim() };
    });
}

function getPartValue(parts, index, count) {
  if (!parts.length) return "";
  if (parts.length === count) return parts[index]?.value ?? "";
  if (parts.length === 1 && !parts[0].label) return parts[0].value;
  return parts[index]?.value ?? "";
}

function parseDate(value) {
  const match = value?.match(/(\d{2,4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!match) return "";
  const year = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  return `${year}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
}

function firstMatch(source, regex) {
  const match = source.match(regex);
  return match ? htmlToText(match[1]) : "";
}

function attrMatch(source, regex) {
  const match = source.match(regex);
  return match ? decodeEntities(match[1]) : "";
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function decodeEntities(value) {
  return value.replace(/&(nbsp|amp|lt|gt|quot);|&#039;/g, (match) => entityMap[match] ?? match);
}

async function attachLocations(data, log, { writeCache = true } = {}) {
  const cachePath = path.join(__dirname, "gsi-geocode-cache.json");
  const cache = await readJson(cachePath, {});

  for (const [index, shop] of data.shops.entries()) {
    const key = `${shop.name}|${shop.address}`;
    if (!cache[key]) {
      cache[key] = await geocode(shop);
      if (writeCache) {
        await fs.writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
      }
      await sleep(250);
    }
    shop.location = cache[key];
    if (log) {
      console.log(`${index + 1}/${data.shops.length} ${shop.name}: ${shop.location.lat ?? "not found"}`);
    }
  }
}

async function geocode(shop) {
  const query = normalizeAddress(shop);
  const url = new URL("https://msearch.gsi.go.jp/address-search/AddressSearch");
  url.searchParams.set("q", query);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CodexAipriContestMapPrototype/1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`GSI geocoder failed: ${response.status} ${response.statusText}`);

  const results = await response.json();
  if (!results.length) return { lat: null, lng: null, geocodeLabel: "", geocodeQuery: query };

  const [lng, lat] = results[0].geometry.coordinates;
  return {
    lat: Number(lat),
    lng: Number(lng),
    geocodeLabel: results[0].properties.title,
    geocodeQuery: query,
  };
}

function normalizeAddress(shop) {
  const override = addressOverrides.get(shop.name);
  if (override) return override;
  const cleaned = shop.address
    .replace(new RegExp(`^${shop.prefecture}`), "")
    .replace(/^名古屋市中村区名古屋市中村区/, "名古屋市中村区")
    .replace(/店内$/, "")
    .replace(/\b[0-9０-９]+F\b/gi, "")
    .replace(/\s+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${shop.prefecture}${cleaned}`;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshData().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
