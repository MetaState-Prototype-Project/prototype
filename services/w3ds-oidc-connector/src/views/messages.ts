import { escapeHtml, page } from "./page.js";

export function messagePage(options: {
    nonce: string;
    title: string;
    message: string;
    tone?: "error" | "ok";
}): string {
    return page({
        title: options.title,
        nonce: options.nonce,
        body: `<h1>${escapeHtml(options.title)}</h1>
<p class="status ${options.tone ?? ""}">${escapeHtml(options.message)}</p>`,
    });
}
