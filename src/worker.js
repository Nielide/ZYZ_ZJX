const DATA_ORIGIN = "https://raw.githubusercontent.com/Nielide/ZYZ_ZJX/main/data/data.json";

async function serveLatestData(request, env) {
  try {
    const response = await fetch(DATA_ORIGIN, {
      headers: { Accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: 120 }
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);

    const body = await response.text();
    JSON.parse(body);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=120",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = "/data/data.json";
    fallbackUrl.search = "";
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/data/data.json") {
      return serveLatestData(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
