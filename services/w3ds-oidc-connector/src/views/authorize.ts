import { escapeHtml, page, scriptJson } from "./page.js";

/**
 * Runs in the browser: waits on the session's SSE stream and follows the
 * redirect once the wallet has signed. Kept dependency-free so it can be
 * inlined under the page's CSP nonce.
 */
const CLIENT_SCRIPT = `
(function () {
    var data = JSON.parse(document.getElementById("login-data").textContent);
    var status = document.getElementById("status");
    var countdown = document.getElementById("countdown");
    var source = null;
    var finished = false;

    function show(text, tone) {
        status.textContent = text;
        status.className = "status" + (tone ? " " + tone : "");
    }

    function finish(text, tone) {
        finished = true;
        if (source) source.close();
        show(text, tone);
    }

    function tick() {
        if (finished) return;
        var left = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
        countdown.textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
        if (left === 0) finish("This login has expired. Go back to the site and try again.", "error");
    }

    function connect() {
        if (finished || (source && source.readyState !== 2)) return;
        source = new EventSource(data.events);
        source.addEventListener("approved", function (event) {
            finished = true;
            source.close();
            show("Approved. Continuing\\u2026", "ok");
            window.location.replace(JSON.parse(event.data).redirect);
        });
        source.addEventListener("expired", function () {
            finish("This login has expired or was already used. Go back to the site and try again.", "error");
        });
        source.addEventListener("attempt_failed", function () {
            show("That signature could not be verified. Try scanning again.", "error");
        });
        source.onerror = function () {
            if (!finished && source.readyState === 2) {
                show("Lost connection. Keep this page open in the browser you started from.", "error");
            }
        };
    }

    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") connect();
    });
    setInterval(tick, 1000);
    tick();
    connect();
})();
`;

export function authorizePage(options: {
    nonce: string;
    platformName: string;
    clientName?: string;
    /** Overrides the "Log in to …" heading. */
    heading?: string;
    /** The application's logo; the connector's own when it has none. */
    logoUrl?: string | null;
    walletLink: string;
    qrSvg: string;
    eventsUrl: string;
    expiresAt: number;
}): string {
    const heading =
        options.heading ??
        (options.clientName
            ? `Log in to ${options.clientName}`
            : `Log in with ${options.platformName}`);
    return page({
        title: heading,
        nonce: options.nonce,
        body: `<img class="app-logo" src="${escapeHtml(options.logoUrl || "/logo.png")}" alt="" referrerpolicy="no-referrer">
<h1>${escapeHtml(heading)}</h1>
<p>Scan this code with your eID Wallet to sign in.</p>
<div class="qr">${options.qrSvg}</div>
<a class="button" href="${escapeHtml(options.walletLink)}">Open in eID Wallet</a>
<p class="status" id="status" role="status" aria-live="polite">Waiting for your wallet…</p>
<p class="small">Expires in <span id="countdown"></span></p>
<script type="application/json" id="login-data" nonce="${options.nonce}">${scriptJson(
            {
                events: options.eventsUrl,
                expiresAt: options.expiresAt,
            },
        )}</script>`,
        script: CLIENT_SCRIPT,
    });
}
