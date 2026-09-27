export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** JSON safe to embed inside a <script> element. */
export function scriptJson(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/[^ -~]/g, (c) =>
            `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
        );
}

/** Colours, type and the pieces every page shares. */
const BASE_STYLES = `
:root {
    color-scheme: light dark;
    --bg: #f6f7f9; --card: #ffffff; --subtle: #f1f3f6; --text: #1d2433;
    --muted: #5b6475; --border: #e2e5eb; --accent: #2b4acb;
    --accent-text: #ffffff; --accent-soft: #e8ecfb; --error: #b42318;
    --error-soft: #fdecea; --ok: #067647; --ok-soft: #e7f6ee;
    --warn: #b54708; --warn-soft: #fef6e7;
}
@media (prefers-color-scheme: dark) {
    :root {
        --bg: #0f1218; --card: #171b23; --subtle: #1d222c; --text: #e6e8ee;
        --muted: #9aa3b5; --border: #2a303c; --accent: #7b93ff;
        --accent-text: #0f1218; --accent-soft: #232a45; --error: #f97066;
        --error-soft: #3a1f1f; --ok: #47cd89; --ok-soft: #173326;
        --warn: #f5a524; --warn-soft: #33270f;
    }
}
* { box-sizing: border-box; }
body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
a { color: var(--accent); }
p { margin: 8px 0; color: var(--muted); }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.875em; overflow-wrap: anywhere; }
.status { margin-top: 16px; font-weight: 500; color: var(--text); }
.status.error { color: var(--error); }
.status.ok { color: var(--ok); }
.small { font-size: 0.85rem; }
.button, button {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px;
    border-radius: 8px; border: 1px solid transparent; background: var(--accent);
    color: var(--accent-text); font: inherit; font-weight: 600;
    text-decoration: none; cursor: pointer; line-height: 1.2; white-space: nowrap;
}
.button.secondary, button.secondary {
    background: var(--card); color: var(--text); border-color: var(--border);
}
button.danger, .button.danger { background: var(--error); color: #fff; }
`;

/** A single centred card: the QR login and message pages. */
const CARD_STYLES = `
body.card {
    min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 16px; font-size: 16px;
}
body.card main {
    width: 100%; max-width: 420px; background: var(--card);
    border: 1px solid var(--border); border-radius: 16px; padding: 32px 24px;
    text-align: center;
}
body.card h1 { font-size: 1.35rem; margin: 0 0 8px; }
body.card .button { margin-top: 8px; padding: 12px 20px; }
.qr { margin: 24px auto 16px; width: 240px; max-width: 100%;
    background: #fff; padding: 12px; border-radius: 12px; }
.qr svg { display: block; width: 100%; height: auto; }
@media (max-width: 640px) {
    .qr { width: 200px; }
}
`;

/** The developer portal: top bar, breadcrumbs, page header, panels, tables. */
const APP_STYLES = `
.topbar { background: var(--card); border-bottom: 1px solid var(--border); }
.topbar-inner, .container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.topbar-inner { height: 60px; display: flex; align-items: center; gap: 16px; }
.brand { display: flex; align-items: center; gap: 10px; color: var(--text);
    text-decoration: none; font-weight: 700; white-space: nowrap; }
.brand-mark { width: 28px; height: 28px; border-radius: 8px; flex: none;
    background: var(--accent); color: var(--accent-text); display: grid;
    place-items: center; font-size: 0.8rem; font-weight: 800; }
.brand-sub { color: var(--muted); font-weight: 500; }
.topbar-nav { display: flex; gap: 4px; margin-left: 8px; }
.topbar-nav a { padding: 6px 10px; border-radius: 8px; color: var(--muted);
    text-decoration: none; font-weight: 500; }
.topbar-nav a.active, .topbar-nav a:hover { background: var(--subtle); color: var(--text); }
.user { margin-left: auto; display: flex; align-items: center; gap: 12px; min-width: 0; }
.user-name { color: var(--muted); font-size: 0.85rem; max-width: 280px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user form { margin: 0; }
.user button { padding: 6px 12px; font-size: 0.85rem; }
.container { padding-top: 20px; padding-bottom: 48px; }
.crumbs { display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.85rem;
    color: var(--muted); margin-bottom: 12px; list-style: none; padding: 0; }
.crumbs li + li::before { content: "/"; margin-right: 6px; color: var(--border); }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); }
.page-header { display: flex; flex-wrap: wrap; align-items: flex-end;
    justify-content: space-between; gap: 12px 24px; margin-bottom: 20px; }
.page-header h1 { font-size: 1.5rem; margin: 0; overflow-wrap: anywhere; }
.page-header p { margin: 4px 0 0; }
.page-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.panel { background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
.panel-header { padding: 14px 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.panel-header h2 { font-size: 1rem; margin: 0; }
.panel-header p { margin: 2px 0 0; font-size: 0.85rem; }
.panel-body { padding: 20px; }
.panel.danger { border-color: var(--error); }
.panel.danger .panel-header { border-bottom-color: var(--error); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th { text-align: left; font-weight: 600; color: var(--muted); font-size: 0.75rem;
    text-transform: uppercase; letter-spacing: 0.04em; padding: 10px 20px;
    background: var(--subtle); border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 12px 20px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--subtle); }
td.name a { font-weight: 600; color: var(--text); text-decoration: none; white-space: nowrap; }
td .copy code { white-space: nowrap; }
td.name a:hover { color: var(--accent); }
td.num, th.num { text-align: right; }
.nowrap { white-space: nowrap; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 0.75rem; font-weight: 600; background: var(--subtle); color: var(--muted);
    white-space: nowrap; }
.badge.accent { background: var(--accent-soft); color: var(--accent); }
.kv { display: grid; grid-template-columns: 200px 1fr; }
.kv > div { padding: 12px 20px; border-bottom: 1px solid var(--border); min-width: 0; }
.kv > div:nth-last-child(-n+2) { border-bottom: none; }
.kv .k { color: var(--muted); font-size: 0.9rem; }
.kv .v p { margin: 0; }
.kv .v .copy + .copy { margin-top: 6px; }
.copy { display: flex; align-items: stretch; min-width: 0; border: 1px solid var(--border);
    border-radius: 8px; background: var(--subtle); overflow: hidden; }
.copy code { flex: 1; min-width: 0; padding: 7px 10px; align-self: center; }
.copy button { border: none; border-left: 1px solid var(--border); border-radius: 0;
    background: var(--card); color: var(--text); font-size: 0.8rem; padding: 6px 12px; flex: none; }
.copy button:hover { background: var(--accent-soft); color: var(--accent); }
.copy button.copied { color: var(--ok); }
.copy.secret { border-color: var(--ok); }
.callout { border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px;
    margin-bottom: 20px; background: var(--card); }
.callout p { margin: 0; color: var(--text); }
.callout.ok { border-color: var(--ok); background: var(--ok-soft); }
.callout.warn { border-color: var(--warn); background: var(--warn-soft); }
.callout.error ul { margin: 0; padding-left: 18px; color: var(--error); }
.callout.error { border-color: var(--error); background: var(--error-soft); }
.steps { margin: 0; padding-left: 20px; }
.steps li { margin: 8px 0; color: var(--text); }
.steps .copy { margin-top: 6px; max-width: 640px; }
.setup { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.setup .panel { margin-bottom: 0; }
.empty { text-align: center; padding: 48px 20px; }
.empty h2 { margin: 0 0 6px; font-size: 1.1rem; }
.empty .button { margin-top: 12px; }
.form-row { margin-bottom: 18px; }
.form-row:last-child { margin-bottom: 0; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
.hint { font-weight: 400; color: var(--muted); font-size: 0.85rem; margin: 6px 0 0; }
input[type=text], textarea {
    width: 100%; padding: 9px 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
    font: inherit;
}
input[type=text]:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
textarea { min-height: 110px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.875rem; resize: vertical; }
.check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; margin: 0; }
.check input { margin-top: 4px; }
.check strong { display: block; }
.panel-footer { padding: 14px 20px; border-top: 1px solid var(--border);
    background: var(--subtle); display: flex; flex-wrap: wrap; gap: 8px; }
.row-between { display: flex; flex-wrap: wrap; align-items: center;
    justify-content: space-between; gap: 12px; }
.row-between p { margin: 0; }
@media (max-width: 720px) {
    .topbar-inner, .container { padding-left: 16px; padding-right: 16px; }
    .brand-sub, .topbar-nav { display: none; }
    .user-name { max-width: 140px; }
    .kv { grid-template-columns: 1fr; }
    .kv .k { padding-bottom: 0; border-bottom: none; }
    .setup { grid-template-columns: 1fr; }
    th, td { padding-left: 14px; padding-right: 14px; }
}
`;

export function page(options: {
    title: string;
    nonce: string;
    body: string;
    script?: string;
    /**
     * "card" (default) centres a single card, for the QR login and message
     * pages; "app" is the developer portal shell, whose body brings its own
     * header and container.
     */
    layout?: "card" | "app";
    /** Must match the Referrer-Policy header; portal forms need same-origin. */
    referrer?: "no-referrer" | "same-origin";
}): string {
    const app = options.layout === "app";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="${options.referrer ?? "no-referrer"}">
<title>${escapeHtml(options.title)}</title>
<style nonce="${options.nonce}">${BASE_STYLES}${app ? APP_STYLES : CARD_STYLES}</style>
</head>
<body class="${app ? "app" : "card"}">
${app ? options.body : `<main>\n${options.body}\n</main>`}
${options.script ? `<script nonce="${options.nonce}">${options.script}</script>` : ""}
</body>
</html>`;
}
