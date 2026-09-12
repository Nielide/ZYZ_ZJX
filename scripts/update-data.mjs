import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(here, "..", "data", "data.json");
const finnhubKey = process.env.FINNHUB_API_KEY;

if (!finnhubKey) {
  throw new Error("FINNHUB_API_KEY is required. Add it in GitHub Settings → Secrets and variables → Actions.");
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function shanghaiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function calculateDrawdown(high, current) {
  const safeHigh = Number(high) || 0;
  const safeCurrent = Number(current) || 0;
  return safeHigh ? Number(((safeHigh - safeCurrent) / safeHigh * 100).toFixed(4)) : 0;
}

const data = JSON.parse(await readFile(dataPath, "utf8"));
const date = shanghaiDate();
const now = new Date().toISOString();
const symbol = data.symbol || "QQQM";
const quote = await getJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`);
const fx = await getJson("https://api.frankfurter.dev/v2/rate/USD/CNY");

if (!Number.isFinite(quote.c)) throw new Error(`Finnhub returned no current price for ${symbol}`);
if (!Number.isFinite(fx.rate)) throw new Error("Frankfurter returned no USD/CNY rate");

const price = Number(quote.c);
const shares = Number(data.shares || 0);
const valueUsd = price * shares;
const previousHistory = (data.history || []).filter((item) => item.date !== date).sort((a, b) => a.date.localeCompare(b.date));
const previous = previousHistory.at(-1);
const dailyPnlUsd = previous ? valueUsd - Number(previous.valueUsd || 0) : Number(quote.d || 0) * shares;
const dailyRate = previous?.valueUsd ? dailyPnlUsd / Number(previous.valueUsd) * 100 : Number(quote.dp || 0);
const averageCostUsd = Number(data.averageCostUsd || 0);

data.quote = {
  price,
  change: Number(quote.d || 0),
  changePercent: Number(quote.dp || 0),
  timestamp: now
};
data.fx = { usdCny: Number(fx.rate), date: fx.date || date };
data.costUsd = averageCostUsd;
data.profitUsd = valueUsd - averageCostUsd * shares;
data.valueCny = valueUsd * Number(fx.rate);
data.history = [
  ...previousHistory,
  {
    date,
    priceUsd: price,
    valueUsd,
    valueCny: valueUsd * Number(fx.rate),
    dailyPnlUsd,
    dailyPnlCny: dailyPnlUsd * Number(fx.rate),
    cumulativePnlUsd: valueUsd - averageCostUsd * shares,
    rate: dailyRate
  }
].slice(-730);

let peakValueUsd = -Infinity;
let maxDrawdownUsd = 0;
for (const item of data.history) {
  const value = Number(item.valueUsd);
  if (!Number.isFinite(value)) continue;
  peakValueUsd = Math.max(peakValueUsd, value);
  if (peakValueUsd > 0) maxDrawdownUsd = Math.min(maxDrawdownUsd, value - peakValueUsd);
}
data.maxDrawdownUsd = Number(maxDrawdownUsd.toFixed(2));

if (Array.isArray(data.drawdown)) {
  for (const item of data.drawdown) {
    if (!item.symbol || item.symbol === "NEW") continue;
    try {
      const drawdownQuote = await getJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(item.symbol)}&token=${encodeURIComponent(finnhubKey)}`);
      if (Number.isFinite(drawdownQuote.c)) {
        item.current = Number(drawdownQuote.c);
        item.distance = calculateDrawdown(item.high, item.current);
        item.progressPct = Math.max(0, Math.min(100, 100 - item.distance));
      }
    } catch (error) {
      console.warn(`drawdown update skipped for ${item.symbol}: ${error.message}`);
    }
  }
}

data.updatedAt = now;
await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Updated ${symbol} on ${date}: $${price.toFixed(2)}, USD/CNY ${Number(fx.rate).toFixed(4)}`);
