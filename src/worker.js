const GITHUB_RAW_ORIGIN = "https://raw.githubusercontent.com/Nielide/ZYZ_ZJX/main";
const GITHUB_CONTENTS_API =
  "https://api.github.com/repos/Nielide/ZYZ_ZJX/contents/index.html?ref=main";
const EDGE_TTL_SECONDS = 120;

function getRepositoryPath(pathname) {
  if (pathname === "/") return "/index.html";
  if (pathname.includes("..")) return null;

  const allowed =
    pathname === "/index.html" ||
    pathname === "/data/data.json" ||
    pathname.startsWith("/assets/");

  return allowed ? pathname : null;
}

function fallbackRequest(request, pathname) {
  const fallbackUrl = new URL(request.url);
  fallbackUrl.pathname = pathname;
  fallbackUrl.search = "";
  return new Request(fallbackUrl, request);
}

function getContentType(pathname, upstreamType) {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js") || pathname.endsWith(".mjs")) {
    return "text/javascript; charset=utf-8";
  }
  if (pathname.endsWith(".woff2")) return "font/woff2";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return upstreamType || "application/octet-stream";
}

async function serveLatestRepositoryFile(request, env, pathname) {
  try {
    const isHtml = pathname === "/index.html";
    const originUrl = isHtml ? GITHUB_CONTENTS_API : `${GITHUB_RAW_ORIGIN}${pathname}`;
    const response = await fetch(originUrl, {
      headers: {
        Accept: isHtml
          ? "application/vnd.github.raw+json"
          : pathname.endsWith(".json")
            ? "application/json"
            : "application/octet-stream,*/*;q=0.8",
        "User-Agent": "qqqm-cloudflare-worker"
      },
      cf: { cacheEverything: true, cacheTtl: EDGE_TTL_SECONDS }
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);

    const body = await response.arrayBuffer();
    if (pathname.endsWith(".json")) {
      JSON.parse(new TextDecoder().decode(body));
    }

    const headers = new Headers({
      "Content-Type": getContentType(pathname, response.headers.get("Content-Type")),
      "Cache-Control": pathname.endsWith(".woff2")
        ? "public, max-age=3600, must-revalidate"
        : "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-QQQM-Source": isHtml ? "github-api" : "github-raw"
    });

    return new Response(request.method === "HEAD" ? null : body, {
      status: response.status,
      headers
    });
  } catch (error) {
    const fallback = await env.ASSETS.fetch(fallbackRequest(request, pathname));
    const headers = new Headers(fallback.headers);
    headers.set("X-QQQM-Source", "cloudflare-fallback");
    return new Response(request.method === "HEAD" ? null : fallback.body, {
      status: fallback.status,
      statusText: fallback.statusText,
      headers
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const repositoryPath = getRepositoryPath(url.pathname);

    if ((request.method === "GET" || request.method === "HEAD") && repositoryPath) {
      return serveLatestRepositoryFile(request, env, repositoryPath);
    }

    return env.ASSETS.fetch(request);
  }
};
