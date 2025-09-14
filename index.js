export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle only /hiscores endpoint
    if (url.pathname === "/hiscores") {
      const player = url.searchParams.get("player");
      const game = (url.searchParams.get("game") || "rs3").toLowerCase();

      if (!player) {
        return corsJson({ error: "Missing ?player=username" }, 400);
      }

      // Construct cache key
      const cacheKey = `${game}:${player.toLowerCase()}`;

      // Check KV first
      const cached = await env.RS_HISCORE_KV.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          status: 200,
          headers: corsHeaders("text/plain")
        });
      }

      // Pick API endpoint
      let targetUrl;
      if (game === "osrs") {
        targetUrl = `https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=${encodeURIComponent(player)}`;
      } else {
        targetUrl = `https://secure.runescape.com/m=hiscore/index_lite.ws?player=${encodeURIComponent(player)}`;
      }

      try {
        // Fetch live hiscores
        const res = await fetch(targetUrl, { method: "GET" });
        if (!res.ok) {
          return corsJson({ error: `Hiscore fetch failed (${res.status})` }, 502);
        }

        const text = await res.text();

        // Store in KV with TTL (60 seconds)
        await env.RS_HISCORE_KV.put(cacheKey, text, { expirationTtl: 60 });

        return new Response(text, {
          status: 200,
          headers: corsHeaders("text/plain")
        });
      } catch (err) {
        return corsJson({ error: err.message }, 500);
      }
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

// Helper: CORS headers
function corsHeaders(type = "application/json") {
  return {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

// Helper: JSON responses with CORS
function corsJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders("application/json")
  });
}
