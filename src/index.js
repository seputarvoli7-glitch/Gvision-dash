const SOURCE =
  "http://gvisiontv.channell.my.id/ch/th/th1.php/.mpd?=29";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers":
    "Content-Length,Content-Range,Accept-Ranges",
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

    const reqUrl = new URL(request.url);

    const target =
      reqUrl.searchParams.get("url") || SOURCE;

    try {

      const headers = new Headers();

      headers.set(
        "User-Agent",
        "Mozilla/5.0"
      );

      headers.set(
        "Accept",
        "*/*"
      );

      /*
       * Penting untuk DASH video segment
       */
      const range =
        request.headers.get("Range");

      if (range) {
        headers.set("Range", range);
      }

      const upstream =
        await fetch(target, {
          method: request.method,
          headers
        });

      if (!upstream.ok) {

        return new Response(
          "Upstream: " +
          upstream.status,
          {
            status: upstream.status,
            headers: CORS
          }
        );

      }

      const contentType =
        upstream.headers.get(
          "content-type"
        ) || "";

      /*
       * MPD
       */
      if (
        target.includes(".mpd") ||
        contentType.includes("dash") ||
        contentType.includes("xml")
      ) {

        let mpd =
          await upstream.text();

        const base =
          new URL(target);

        /*
         * BaseURL
         */
        mpd = mpd.replace(
          /<BaseURL([^>]*)>([\s\S]*?)<\/BaseURL>/gi,
          (match, attrs, value) => {

            try {

              const absolute =
                new URL(
                  value.trim(),
                  base
                ).href;

              return (
                "<BaseURL" +
                attrs +
                ">" +
                proxyUrl(
                  reqUrl.origin,
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
         * media=
         * initialization=
         * sourceURL=
         */
        mpd = mpd.replace(
          /(media|initialization|sourceURL)="([^"]+)"/gi,
          (match, attr, value) => {

            try {

              const absolute =
                new URL(
                  value,
                  base
                ).href;

              return (
                attr +
                '="' +
                proxyUrl(
                  reqUrl.origin,
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
       * Segment DASH
       */
      const outHeaders =
        new Headers(CORS);

      const ct =
        upstream.headers.get(
          "content-type"
        );

      const cr =
        upstream.headers.get(
          "content-range"
        );

      const cl =
        upstream.headers.get(
          "content-length"
        );

      const ar =
        upstream.headers.get(
          "accept-ranges"
        );

      if (ct)
        outHeaders.set(
          "Content-Type",
          ct
        );

      if (cr)
        outHeaders.set(
          "Content-Range",
          cr
        );

      if (cl)
        outHeaders.set(
          "Content-Length",
          cl
        );

      if (ar)
        outHeaders.set(
          "Accept-Ranges",
          ar
        );

      return new Response(
        upstream.body,
        {
          status: upstream.status,
          headers: outHeaders
        }
      );

    } catch (error) {

      return new Response(
        "Worker Error: " +
        error.message,
        {
          status: 500,
          headers: CORS
        }
      );

    }
  }
};
