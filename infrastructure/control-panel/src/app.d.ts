// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				ename: string;
			} | null;
		}
		interface PageData {
			user: {
				ename: string;
			} | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
