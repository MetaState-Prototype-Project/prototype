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
`;

export function page(options: {
    title: string;
    nonce: string;
    body: string;
    script?: string;
}): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(options.title)}</title>
<style nonce="${options.nonce}">${STYLES}</style>
</head>
<body>
<main>
${options.body}
</main>
${options.script ? `<script nonce="${options.nonce}">${options.script}</script>` : ""}
</body>
</html>`;
}
