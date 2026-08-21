/**
 * The two pages the bridge renders.
 *
 * Server-rendered, self-contained, no external asset. The QR page carries one
 * inline script — an EventSource — because the browser has no other way to learn
 * that a wallet on a different device has answered.
 */

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const STYLE = `
:root { color-scheme: light dark; --fg: #1d2636; --muted: #5b6478; --bg: #fff; --accent: #5b34d1; --line: #e5e7eb; }
@media (prefers-color-scheme: dark) { :root { --fg: #f3f0ff; --muted: #a3adc2; --bg: #12151f; --accent: #a186ff; --line: #2a2f3d; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem 1rem;
       font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); }
main { width: 100%; max-width: 26rem; text-align: center; }
h1 { font-size: 1.35rem; margin: 0 0 .35rem; }
p { margin: 0 0 1.25rem; color: var(--muted); }
img { width: 15rem; height: 15rem; max-width: 100%; border: 1px solid var(--line); border-radius: .75rem; background: #fff; padding: .75rem; }
.uri { margin-top: 1.25rem; font-size: .8rem; word-break: break-all; color: var(--muted); }
.uri a { color: var(--accent); }
#status { margin-top: 1.25rem; min-height: 1.5rem; font-size: .9rem; }
#status[data-state="error"] { color: #b3261e; font-weight: 600; }
@media (prefers-color-scheme: dark) { #status[data-state="error"] { color: #f2b8b5; } }
.error h1 { color: #b3261e; }
`.trim();

function layout(title: string, bodyHtml: string, bodyClass = ""): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body class="${bodyClass}">
<main>
${bodyHtml}
</main>
</body>
</html>`;
}

export interface QrPageOptions {
    /** The `w3ds://auth` URI, exactly as the wallet expects it. */
    walletUri: string;
    /** A `data:` URI, so the page loads nothing from anywhere. */
    qrDataUri: string;
    eventsUrl: string;
}

export function renderQrPage(options: QrPageOptions): string {
    const body = `
<h1>Sign in with W3DS</h1>
<p>Scan this with your eID Wallet.</p>
<img src="${escapeHtml(options.qrDataUri)}" alt="QR code containing a W3DS authentication request" width="240" height="240">
<p class="uri">On this device? <a href="${escapeHtml(options.walletUri)}">Open your wallet</a></p>
<div id="status" role="status" aria-live="polite">Waiting for your wallet…</div>
<script>
(function () {
    var status = document.getElementById("status");
    var source = new EventSource(${JSON.stringify(options.eventsUrl)});

    source.addEventListener("redirect", function (event) {
        status.textContent = "Signed in. Redirecting…";
        source.close();
        window.location.href = JSON.parse(event.data).url;
    });

    source.addEventListener("error", function (event) {
        // A transport hiccup arrives here too, with no data. Only a message the
        // bridge actually sent is worth showing.
        if (!event.data) return;
        status.dataset.state = "error";
        status.textContent = JSON.parse(event.data).message;
        source.close();
    });
}());
</script>`;

    return layout("Sign in with W3DS", body);
}

/**
 * Shown instead of a redirect when the request cannot be trusted enough to
 * redirect anywhere — an unknown client, or a `redirect_uri` that is not the
 * registered one. Bouncing an error to an unverified URI would make the bridge
 * an open redirector.
 */
export function renderErrorPage(title: string, detail: string): string {
    return layout(
        title,
        `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p>`,
        "error",
    );
}
