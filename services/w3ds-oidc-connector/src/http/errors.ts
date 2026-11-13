import type { Response } from "express";

/** Builds `redirectUri` with `params` merged into its query string. */
export function withQuery(
    redirectUri: string,
    params: Record<string, string | undefined>,
): string {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
}

/** An OAuth error sent back to the client's redirect URI (RFC 6749 §4.1.2.1). */
export function redirectError(
    res: Response,
    redirectUri: string,
    params: {
        error: string;
        description: string;
        state?: string;
        issuer: string;
    },
): void {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(
        302,
        withQuery(redirectUri, {
            error: params.error,
            error_description: params.description,
            state: params.state,
            iss: params.issuer,
        }),
    );
}

/** A JSON OAuth error from a back-channel endpoint (RFC 6749 §5.2). */
export function oauthError(
    res: Response,
    status: number,
    error: string,
    description?: string,
): void {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.status(status).json(
        description ? { error, error_description: description } : { error },
    );
}
