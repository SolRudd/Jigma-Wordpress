import { serializeHtml } from "../parser/html.ts";

export const PREVIEW_HOVER_INSPECTOR_ENABLED = false;

export function createPreviewDocument(input: {
  html: string;
  css: string;
  js: string;
  activeLayerId: string | null;
  deletedLayerIds: Set<string>;
  highlightsEnabled: boolean;
}) {
  const bodyHtml = serializeHtml(input.html, {
    addLayerAttributes: true,
    activeLayerId: null,
    deletedLayerIds: input.deletedLayerIds,
    skipScripts: true,
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: https: http:; font-src data: https: http:;">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      background: #f4f7fb;
      color: #141922;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-x: hidden;
    }
    a { cursor: default; }
${input.css}
  </style>
</head>
<body>
${bodyHtml || `<main style="padding:32px;font:16px/1.5 system-ui;color:#475569;">Run HTML to preview it here.</main>`}
  <script>
    (function () {
      var send = function (message) {
        try {
          parent.postMessage(Object.assign({ source: "jigma-preview" }, message), "*");
        } catch (_) {}
      };

      window.addEventListener("error", function (event) {
        send({
          type: "runtime-error",
          message: event.message || "Preview runtime error",
          detail: [event.filename, event.lineno, event.colno].filter(Boolean).join(":")
        });
      });

      window.addEventListener("unhandledrejection", function (event) {
        var reason = event.reason;
        send({
          type: "runtime-error",
          message: reason && reason.message ? reason.message : String(reason || "Unhandled promise rejection"),
          detail: "Promise rejection"
        });
      });

      send({ type: "ready" });
    })();
  </script>
</body>
</html>`;
}
