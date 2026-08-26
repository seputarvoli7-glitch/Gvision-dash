const SOURCE =
  "http://gvisiontv.channell.my.id/ch/th/th1.php/.mpd?=29";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges",
  "Cache-Control": "no-cache"
};

function workerUrl(origin, url) {
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

    const target =
      current.searchParams.get("url") || SOURCE;

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

      const range =
        request.headers.get("Range");

      if (range) {
        headers.set("Range", range);
      }

      const upstream = await fetch(target, {
        method: request.method,
        headers
      });

      if (!upstream.ok) {
        return new Response(
          "Upstream error: " +
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
       * ============================
       * MPD MANIFEST
       * ============================
       */

      if (
        target.includes(".mpd") ||
        contentType.includes("xml") ||
        contentType.includes("dash")
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
                workerUrl(
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
         * initialization
         *
         * Jangan ubah $Time$
         */

        mpd = mpd.replace(
          /initialization="([^"]+)"/gi,
          (match, value) => {

            try {

              const absolute =
                new URL(
                  value,
                  base
                ).href;

              return (
                'initialization="' +
                workerUrl(
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

        /*
         * media
         *
         * $Time$ dipertahankan
         */

        mpd = mpd.replace(
          /media="([^"]+)"/gi,
          (match, value) => {

            try {

              /*
               * Buat URL absolut,
               * tetapi jangan encode
               * tanda $Time$ sebelum
               * dash.js memprosesnya.
               */

              const absolute =
                new URL(
                  value,
                  base
                ).href;

              const proxy =
                current.origin +
                "/?url=" +
                encodeURIComponent(
                  absolute
                );

              return (
                'media="' +
                proxy +
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
       * ============================
       * SEGMENT VIDEO / AUDIO
       * ============================
       */

      const output =
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
        output.set(
          "Content-Type",
          ct
        );

      if (cr)
        output.set(
          "Content-Range",
          cr
        );

      if (cl)
        output.set(
          "Content-Length",
          cl
        );

      if (ar)
        output.set(
          "Accept-Ranges",
          ar
        );

      return new Response(
        upstream.body,
        {
          status: upstream.status,
          headers: output
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
