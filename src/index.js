const SOURCE =
  "http://gvisiontv.channell.my.id/ch/th/th1.php/.mpd?=29";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-cache"
};

function proxyUrl(origin, url) {
  return origin + "/?url=" + encodeURIComponent(url);
}

export default {
  async fetch(request) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS
      });
    }

    const current = new URL(request.url);

    let target =
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
          "Upstream error: " + response.status,
          {
            status: response.status,
            headers: CORS
          }
        );
      }

      const contentType =
        response.headers.get("content-type") || "";

      /*
       * MPD
       */
      if (
        target.includes(".mpd") ||
        contentType.includes("xml") ||
        contentType.includes("dash")
      ) {

        let mpd = await response.text();

        const base = new URL(target);

        /*
         * BaseURL
         */
        mpd = mpd.replace(
          /<BaseURL>(.*?)<\/BaseURL>/gi,
          (match, value) => {

            try {

              const absolute =
                new URL(
                  value.trim(),
                  base
                ).href;

              return (
                "<BaseURL>" +
                proxyUrl(
                  current.origin,
                  absolute
                ) +
                "</BaseURL>"
              );

            } catch {

              return match;

            }
          }
        );

        /*
         * href / sourceURL / media / initialization
         */
        mpd = mpd.replace(
          /(media|initialization|sourceURL|href)="([^"]+)"/gi,
          (match, attribute, value) => {

            try {

              const absolute =
                new URL(
                  value,
                  base
                ).href;

              return (
                attribute +
                '="' +
                proxyUrl(
                  current.origin,
                  absolute
                ) +
                '"'
              );

            } catch {

              return match;

            }
          }
        );

        return new Response(
          mpd,
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
       * Segment video
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
