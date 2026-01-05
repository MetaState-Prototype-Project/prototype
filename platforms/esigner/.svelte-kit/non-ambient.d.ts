
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/(protected)" | "/(auth)" | "/" | "/(auth)/auth" | "/(protected)/files" | "/(protected)/files/new" | "/(protected)/files/[id]";
		RouteParams(): {
			"/(protected)/files/[id]": { id: string }
		};
		LayoutParams(): {
			"/(protected)": { id?: string };
			"/(auth)": Record<string, never>;
			"/": { id?: string };
			"/(auth)/auth": Record<string, never>;
			"/(protected)/files": { id?: string };
			"/(protected)/files/new": Record<string, never>;
			"/(protected)/files/[id]": { id: string }
		};
		Pathname(): "/" | "/auth" | "/auth/" | "/files" | "/files/" | "/files/new" | "/files/new/" | `/files/${string}` & {} | `/files/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}