// this file is generated — do not edit it

declare module "svelte/elements" {
    export interface HTMLAttributes<T> {
        "data-sveltekit-keepfocus"?: true | "" | "off" | undefined | null;
        "data-sveltekit-noscroll"?: true | "" | "off" | undefined | null;
        "data-sveltekit-preload-code"?:
            | true
            | ""
            | "eager"
            | "viewport"
            | "hover"
            | "tap"
            | "off"
            | undefined
            | null;
        "data-sveltekit-preload-data"?:
            | true
            | ""
            | "hover"
            | "tap"
            | "off"
            | undefined
            | null;
        "data-sveltekit-reload"?: true | "" | "off" | undefined | null;
        "data-sveltekit-replacestate"?: true | "" | "off" | undefined | null;
    }
}

export {};

declare module "$app/types" {
    export interface AppTypes {
        RouteId():
            | "/(protected)"
            | "/(auth)"
            | "/"
            | "/(auth)/auth"
            | "/(auth)/deeplink-login"
            | "/(protected)/files"
            | "/(protected)/files/[id]"
            | "/(protected)/storage";
        RouteParams(): {
            "/(protected)/files/[id]": { id: string };
        };
        LayoutParams(): {
            "/(protected)": { id?: string };
            "/(auth)": Record<string, never>;
            "/": { id?: string };
            "/(auth)/auth": Record<string, never>;
            "/(auth)/deeplink-login": Record<string, never>;
            "/(protected)/files": { id?: string };
            "/(protected)/files/[id]": { id: string };
            "/(protected)/storage": Record<string, never>;
        };
        Pathname():
            | "/"
            | "/auth"
            | "/auth/"
            | "/deeplink-login"
            | "/deeplink-login/"
            | "/files"
            | "/files/"
            | (`/files/${string}` & {})
            | (`/files/${string}/` & {})
            | "/storage"
            | "/storage/";
        ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes["Pathname"]>}`;
        Asset():
            | "/android-chrome-192x192.png"
            | "/android-chrome-512x512.png"
            | "/apple-touch-icon.png"
            | "/favicon-16x16.png"
            | "/favicon-32x32.png"
            | "/favicon.ico"
            | "/site.webmanifest"
            | (string & {});
    }
}
