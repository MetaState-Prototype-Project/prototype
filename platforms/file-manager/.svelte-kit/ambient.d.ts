
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const _ZO_DOCTOR: string;
	export const SSH_AGENT_PID: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const FNM_LOGLEVEL: string;
	export const NODE: string;
	export const INIT_CWD: string;
	export const SHELL: string;
	export const TERM: string;
	export const FNM_NODE_DIST_MIRROR: string;
	export const VSCODE_PROCESS_TITLE: string;
	export const HOMEBREW_REPOSITORY: string;
	export const TMPDIR: string;
	export const npm_config_npm_globalconfig: string;
	export const CURSOR_TRACE_ID: string;
	export const MallocNanoZone: string;
	export const NO_COLOR: string;
	export const npm_config_registry: string;
	export const PNPM_HOME: string;
	export const ZSH: string;
	export const FNM_COREPACK_ENABLED: string;
	export const USER: string;
	export const LS_COLORS: string;
	export const COMMAND_MODE: string;
	export const npm_config_globalconfig: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_config_strict_peer_dependencies: string;
	export const SSH_AUTH_SOCK: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_execpath: string;
	export const PAGER: string;
	export const FNM_VERSION_FILE_STRATEGY: string;
	export const LSCOLORS: string;
	export const npm_config_frozen_lockfile: string;
	export const npm_config_verify_deps_before_run: string;
	export const FNM_ARCH: string;
	export const PATH: string;
	export const npm_package_json: string;
	export const __CFBundleIdentifier: string;
	export const PWD: string;
	export const npm_command: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const npm_config__jsr_registry: string;
	export const npm_lifecycle_event: string;
	export const CURSOR_AGENT: string;
	export const npm_package_name: string;
	export const NODE_PATH: string;
	export const FNM_MULTISHELL_PATH: string;
	export const XPC_FLAGS: string;
	export const npm_config_optional: string;
	export const FORCE_COLOR: string;
	export const npm_config_node_gyp: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_package_version: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const HOME: string;
	export const SHLVL: string;
	export const VSCODE_NLS_CONFIG: string;
	export const HOMEBREW_PREFIX: string;
	export const CI: string;
	export const FNM_DIR: string;
	export const LESS: string;
	export const LOGNAME: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const VSCODE_IPC_HOOK: string;
	export const FNM_RESOLVE_ENGINES: string;
	export const VSCODE_PID: string;
	export const npm_config_user_agent: string;
	export const HOMEBREW_CELLAR: string;
	export const INFOPATH: string;
	export const VSCODE_CWD: string;
	export const VSCODE_L10N_BUNDLE_LOCATION: string;
	export const npm_node_execpath: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	export const PUBLIC_REGISTRY_URL: string;
	export const PUBLIC_PROVISIONER_URL: string;
	export const PUBLIC_EID_WALLET_TOKEN: string;
	export const PUBLIC_PICTIQUE_BASE_URL: string;
	export const PUBLIC_APP_STORE_EID_WALLET: string;
	export const PUBLIC_PLAY_STORE_EID_WALLET: string;
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		_ZO_DOCTOR: string;
		SSH_AGENT_PID: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		FNM_LOGLEVEL: string;
		NODE: string;
		INIT_CWD: string;
		SHELL: string;
		TERM: string;
		FNM_NODE_DIST_MIRROR: string;
		VSCODE_PROCESS_TITLE: string;
		HOMEBREW_REPOSITORY: string;
		TMPDIR: string;
		npm_config_npm_globalconfig: string;
		CURSOR_TRACE_ID: string;
		MallocNanoZone: string;
		NO_COLOR: string;
		npm_config_registry: string;
		PNPM_HOME: string;
		ZSH: string;
		FNM_COREPACK_ENABLED: string;
		USER: string;
		LS_COLORS: string;
		COMMAND_MODE: string;
		npm_config_globalconfig: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_config_strict_peer_dependencies: string;
		SSH_AUTH_SOCK: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_execpath: string;
		PAGER: string;
		FNM_VERSION_FILE_STRATEGY: string;
		LSCOLORS: string;
		npm_config_frozen_lockfile: string;
		npm_config_verify_deps_before_run: string;
		FNM_ARCH: string;
		PATH: string;
		npm_package_json: string;
		__CFBundleIdentifier: string;
		PWD: string;
		npm_command: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		VSCODE_ESM_ENTRYPOINT: string;
		npm_config__jsr_registry: string;
		npm_lifecycle_event: string;
		CURSOR_AGENT: string;
		npm_package_name: string;
		NODE_PATH: string;
		FNM_MULTISHELL_PATH: string;
		XPC_FLAGS: string;
		npm_config_optional: string;
		FORCE_COLOR: string;
		npm_config_node_gyp: string;
		XPC_SERVICE_NAME: string;
		npm_package_version: string;
		pnpm_config_verify_deps_before_run: string;
		HOME: string;
		SHLVL: string;
		VSCODE_NLS_CONFIG: string;
		HOMEBREW_PREFIX: string;
		CI: string;
		FNM_DIR: string;
		LESS: string;
		LOGNAME: string;
		npm_lifecycle_script: string;
		VSCODE_CODE_CACHE_PATH: string;
		VSCODE_IPC_HOOK: string;
		FNM_RESOLVE_ENGINES: string;
		VSCODE_PID: string;
		npm_config_user_agent: string;
		HOMEBREW_CELLAR: string;
		INFOPATH: string;
		VSCODE_CWD: string;
		VSCODE_L10N_BUNDLE_LOCATION: string;
		npm_node_execpath: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		PUBLIC_REGISTRY_URL: string;
		PUBLIC_PROVISIONER_URL: string;
		PUBLIC_EID_WALLET_TOKEN: string;
		PUBLIC_PICTIQUE_BASE_URL: string;
		PUBLIC_APP_STORE_EID_WALLET: string;
		PUBLIC_PLAY_STORE_EID_WALLET: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
