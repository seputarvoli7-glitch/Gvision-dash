const SOURCE =
  "http://gvisiontv.channell.my.id/ch/th/th1.php/.mpd?=29";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-cache"
};

export default {
  async fetch(request) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS
      });
    }

    const current = new URL(request.url);
    const target =
      current.searchParams.get("url") || SOURCE;

    try {

      const response = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "*/*"
        }
      });

      if (!response.ok) {
        return new Response(
          "Gvision upstream error: " +
          response.status,
          {
            status: response.status,
            headers: CORS
          }
        );
      }

      const type =
        response.headers.get("content-type") || "";

      /*
       * MPD MANIFEST
       */
      if (
        target.includes(".mpd") ||
        type.includes("dash") ||
        type.includes("xml")
      ) {

        const text = await response.text();

        const base = new URL(target);

        /*
         * Rewrite URL di MPD.
         */
        const rewritten = text.replace(
          /(?:https?:)?\/\/[^"'<> ]+|[^"'<> ]+\.(?:m4s|mp4)(?:\?[^"'<> ]*)?/g,
          match => {

            try {

              const absolute =
                new URL(match, base).href;

              return (
                current.origin +
                "/?url=" +
                encodeURIComponent(absolute)
              );

            } catch {

              return match;

            }

          }
        );

        return new Response(
          rewritten,
          {
            status: 200,
            headers: {
              ...CORS,
              "Content-Type":
                "application/dash+xml"
            }
          }
        );
      }

      /*
       * VIDEO SEGMENT
       */
      return new Response(
        response.body,
        {
          status: response.status,
          headers: {
            ...CORS,
            "Content-Type":
              response.headers.get(
                "content-type"
              ) || "video/mp4"
          }
        }
      );

    } catch (error) {

      return new Response(
        "DASH Worker Error: " +
        error.message,
        {
          status: 500,
          headers: CORS
        }
      );

    }
  }
};
