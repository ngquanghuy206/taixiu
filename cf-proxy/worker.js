/**
 * TX·AI — Cloudflare Worker Proxy
 * Strip X-Frame-Options + CSP → cho phép nhúng iframe
 *
 * Deploy: wrangler deploy  hoặc paste vào Cloudflare Dashboard
 *
 * Usage:  https://<worker-domain>/proxy?url=https://sunwin.mw
 */

// Danh sách domain được phép proxy (whitelist)
const ALLOWED_ORIGINS = [
  "sunwin.mw",
  "www.sunwin.mw",
  "play.xocdia88.green",
  "xocdia88.green",
  "v.hitclub.si",
  "hitclub.si",
  "lc79c.bet",
  "www.lc79c.bet",
  "play.betvip.fit",
  "betvip.fit",
];

// Domain của web tool (cho CORS)
const TOOL_ORIGINS = [
  "https://anhnamtaixiu.vercel.app",
  "http://localhost:3000",
  "http://localhost:5500",
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === "OPTIONS") {
      return corsResponse("", 204);
    }

    // ── Health check ────────────────────────────────────────
    if (url.pathname === "/" || url.pathname === "/health") {
      return corsResponse(JSON.stringify({ ok: true, service: "tx-proxy" }), 200, "application/json");
    }

    // ── Proxy endpoint: /proxy?url=<target> ─────────────────
    if (url.pathname === "/proxy") {
      const targetParam = url.searchParams.get("url");
      if (!targetParam) {
        return corsResponse("Missing ?url= param", 400);
      }

      let targetUrl;
      try {
        targetUrl = new URL(decodeURIComponent(targetParam));
      } catch {
        return corsResponse("Invalid URL", 400);
      }

      // Whitelist check
      const hostname = targetUrl.hostname.replace(/^www\./, "");
      const allowed  = ALLOWED_ORIGINS.some(o => {
        const clean = o.replace(/^www\./, "");
        return hostname === clean || hostname.endsWith("." + clean);
      });
      if (!allowed) {
        return corsResponse(`Domain not allowed: ${targetUrl.hostname}`, 403);
      }

      // ── Fetch target ──────────────────────────────────────
      const reqHeaders = new Headers();
      // Forward một số headers quan trọng
      for (const h of ["accept", "accept-language", "cache-control", "user-agent"]) {
        if (request.headers.has(h)) reqHeaders.set(h, request.headers.get(h));
      }
      // Giả lập trình duyệt thật
      reqHeaders.set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
      reqHeaders.set("Referer", targetUrl.origin + "/");
      reqHeaders.set("Origin", targetUrl.origin);

      let upstream;
      try {
        upstream = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: reqHeaders,
          body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
          redirect: "follow",
        });
      } catch (e) {
        return corsResponse(`Fetch error: ${e.message}`, 502);
      }

      // ── Rewrite response headers ──────────────────────────
      const respHeaders = new Headers(upstream.headers);

      // XÓA các header chặn iframe
      respHeaders.delete("X-Frame-Options");
      respHeaders.delete("x-frame-options");
      respHeaders.delete("Content-Security-Policy");
      respHeaders.delete("content-security-policy");
      respHeaders.delete("Content-Security-Policy-Report-Only");

      // Thêm CORS + cho phép nhúng iframe
      respHeaders.set("Access-Control-Allow-Origin", "*");
      respHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      respHeaders.set("Access-Control-Allow-Headers", "*");

      // ── Rewrite HTML: fix relative URLs → absolute ────────
      const contentType = upstream.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        let html = await upstream.text();
        const base = targetUrl.origin;

        // Thêm <base> tag để relative links hoạt động đúng
        html = html.replace(
          /<head([^>]*)>/i,
          `<head$1><base href="${base}/">`
        );

        // Rewrite absolute URLs trong src/href để qua proxy
        // (chỉ rewrite các domain trong whitelist)
        // Thêm script inject để fix navigation
        const injectScript = `
<script>
(function() {
  // Fix links: intercept navigation để giữ trong proxy
  document.addEventListener('click', function(e) {
    const a = e.target.closest('a');
    if (!a || !a.href) return;
    try {
      const u = new URL(a.href);
      // Nếu là external link, để mặc định (mở trong frame)
    } catch {}
  }, true);
})();
</script>`;
        html = html.replace("</head>", injectScript + "</head>");

        return new Response(html, {
          status: upstream.status,
          headers: respHeaders,
        });
      }

      // Non-HTML (JS, CSS, images...) — pass through
      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    }

    return corsResponse("Not found", 404);
  },
};

function corsResponse(body, status = 200, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
