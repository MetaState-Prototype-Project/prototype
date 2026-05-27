import { invoke } from "@tauri-apps/api/core";

type Level = "log" | "info" | "warn" | "error" | "debug";

/**
 * Mirror frontend `console.*` calls to the Tauri host process stdout/stderr.
 * Useful when the WebView devtools aren't attachable (mobile, Wayland quirks)
 * — calls are forwarded to the `log_to_terminal` Tauri command and show up
 * in the terminal that ran `pnpm tauri dev` / `cargo tauri dev`.
 *
 * Idempotent and side-effect-free if called outside a Tauri context.
 */
let installed = false;

export function installTerminalConsoleBridge(): void {
    if (installed) return;
    installed = true;

    const levels: Level[] = ["log", "info", "warn", "error", "debug"];
    for (const level of levels) {
        const original = console[level].bind(console);
        console[level] = (...args: unknown[]) => {
            original(...args);
            try {
                const message = args
                    .map((a) => {
                        if (typeof a === "string") return a;
                        if (a instanceof Error) {
                            return `${a.name}: ${a.message}${
                                a.stack ? `\n${a.stack}` : ""
                            }`;
                        }
                        try {
                            return JSON.stringify(a);
                        } catch {
                            return String(a);
                        }
                    })
                    .join(" ");
                void invoke("log_to_terminal", {
                    level,
                    message,
                }).catch(() => {
                    // Not in Tauri context, or command not registered — drop.
                });
            } catch {
                // Bridge must never break console output.
            }
        };
    }

    // Surface unhandled errors/rejections too.
    window.addEventListener("error", (event) => {
        void invoke("log_to_terminal", {
            level: "error",
            message: `Unhandled error: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
        }).catch(() => {});
    });
    window.addEventListener("unhandledrejection", (event) => {
        const reason = event.reason;
        const msg =
            reason instanceof Error
                ? `${reason.name}: ${reason.message}${reason.stack ? `\n${reason.stack}` : ""}`
                : String(reason);
        void invoke("log_to_terminal", {
            level: "error",
            message: `Unhandled rejection: ${msg}`,
        }).catch(() => {});
    });
}
