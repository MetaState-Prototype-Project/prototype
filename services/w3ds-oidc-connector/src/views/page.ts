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

const STYLES = `
:root {
    color-scheme: light dark;
    --bg: #f6f7f9; --card: #ffffff; --text: #1d2433; --muted: #5b6475;
    --border: #e2e5eb; --accent: #2b4acb; --accent-text: #ffffff;
    --error: #b42318; --ok: #067647;
}
@media (prefers-color-scheme: dark) {
    :root {
        --bg: #0f1218; --card: #181c24; --text: #e6e8ee; --muted: #9aa3b5;
        --border: #2a303c; --accent: #7b93ff; --accent-text: #0f1218;
        --error: #f97066; --ok: #47cd89;
    }
}
* { box-sizing: border-box; }
body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 16px; background: var(--bg);
    color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main {
    width: 100%; max-width: 420px; background: var(--card);
    border: 1px solid var(--border); border-radius: 16px; padding: 32px 24px;
    text-align: center;
}
h1 { font-size: 1.35rem; margin: 0 0 8px; }
p { margin: 8px 0; color: var(--muted); }
.qr { margin: 24px auto 16px; width: 240px; max-width: 100%;
    background: #fff; padding: 12px; border-radius: 12px; }
.qr svg { display: block; width: 100%; height: auto; }
.button {
    display: inline-block; margin-top: 8px; padding: 12px 20px;
    border-radius: 10px; background: var(--accent); color: var(--accent-text);
    text-decoration: none; font-weight: 600;
}
.status { margin-top: 16px; font-weight: 500; color: var(--text); }
.status.error { color: var(--error); }
.status.ok { color: var(--ok); }
.small { font-size: 0.85rem; }
@media (max-width: 640px) {
    .qr { width: 200px; }
}
main.wide { max-width: 760px; text-align: left; padding: 24px; }
main.wide h1 { margin-bottom: 4px; }
main.wide h2 { font-size: 1.05rem; margin: 24px 0 8px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
    justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px;
    border-bottom: 1px solid var(--border); }
.bar .who { color: var(--muted); font-size: 0.9rem; overflow-wrap: anywhere; }
.bar form { margin: 0; }
a { color: var(--accent); }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9em; overflow-wrap: anywhere; }
label { display: block; font-weight: 600; margin: 16px 0 6px; }
.hint { font-weight: 400; color: var(--muted); font-size: 0.85rem; margin: 4px 0 0; }
input[type=text], textarea {
    width: 100%; padding: 10px 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
    font: inherit;
}
textarea { min-height: 96px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9rem; }
.check { display: flex; gap: 10px; align-items: flex-start; font-weight: 400; }
.check input { margin-top: 4px; }
button, .button {
    display: inline-block; padding: 10px 16px; border-radius: 10px;
    border: 1px solid transparent; background: var(--accent);
    color: var(--accent-text); font: inherit; font-weight: 600;
    text-decoration: none; cursor: pointer;
}
button.secondary, .button.secondary {
    background: transparent; color: var(--text); border-color: var(--border);
}
button.danger { background: var(--error); color: #fff; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.errors { border: 1px solid var(--error); color: var(--error);
    border-radius: 10px; padding: 8px 16px; }
.errors li { margin: 4px 0; }
.card { border: 1px solid var(--border); border-radius: 12px; padding: 16px;
    margin: 12px 0; }
.card h3 { margin: 0 0 4px; font-size: 1rem; }
.meta { color: var(--muted); font-size: 0.85rem; margin: 2px 0; }
dl.fields { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px;
    margin: 12px 0; }
dl.fields dt { color: var(--muted); }
dl.fields dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 640px) {
    dl.fields { grid-template-columns: 1fr; gap: 2px; }
    dl.fields dd { margin-bottom: 8px; }
}
.secret { border: 1px solid var(--ok); border-radius: 12px; padding: 16px; margin: 16px 0; }
`;

export function page(options: {
    title: string;
    nonce: string;
    body: string;
    script?: string;
    /** A wide, left-aligned layout for the developer portal. */
    wide?: boolean;
    /** Must match the Referrer-Policy header; portal forms need same-origin. */
    referrer?: "no-referrer" | "same-origin";
}): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="${options.referrer ?? "no-referrer"}">
<title>${escapeHtml(options.title)}</title>
<style nonce="${options.nonce}">${STYLES}</style>
</head>
<body>
<main${options.wide ? ' class="wide"' : ""}>
${options.body}
</main>
${options.script ? `<script nonce="${options.nonce}">${options.script}</script>` : ""}
</body>
</html>`;
}
