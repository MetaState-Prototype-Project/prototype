
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
	export const NEO4J_URI: string;
	export const NEO4J_USER: string;
	export const NEO4J_PASSWORD: string;
	export const REGISTRY_ENTROPY_KEY_JWK: string;
	export const ENCRYPTION_PASSWORD: string;
	export const W3ID: string;
	export const REGISTRY_DATABASE_URL: string;
	export const REGISTRY_SHARED_SECRET: string;
	export const PROVISIONER_DATABASE_URL: string;
	export const VERIFF_HMAC_KEY: string;
	export const DUPLICATES_POLICY: string;
	export const IP_ADDR: string;
	export const PICTIQUE_DATABASE_URL: string;
	export const PICTIQUE_MAPPING_DB_PATH: string;
	export const BLABSY_MAPPING_DB_PATH: string;
	export const DREAMSYNC_MAPPING_DB_PATH: string;
	export const GROUP_CHARTER_MAPPING_DB_PATH: string;
	export const CERBERUS_MAPPING_DB_PATH: string;
	export const GOOGLE_APPLICATION_CREDENTIALS: string;
	export const PICTIQUE_JWT_SECRET: string;
	export const GROUP_CHARTER_DATABASE_URL: string;
	export const CHARTER_JWT_SECRET: string;
	export const CERBERUS_DATABASE_URL: string;
	export const EVOTING_DATABASE_URL: string;
	export const EVOTING_MAPPING_DB_PATH: string;
	export const OPENAI_API_KEY: string;
	export const NOTIFICATION_SHARED_SECRET: string;
	export const DREAMSYNC_DATABASE_URL: string;
	export const VITE_DREAMSYNC_BASE_URL: string;
	export const EREPUTATION_DATABASE_URL: string;
	export const EREPUTATION_MAPPING_DB_PATH: string;
	export const VITE_EREPUTATION_BASE_URL: string;
	export const SHELL: string;
	export const npm_command: string;
	export const COLORTERM: string;
	export const npm_config_optional: string;
	export const npm_config_npm_globalconfig: string;
	export const NODE: string;
	export const npm_config_verify_deps_before_run: string;
	export const npm_config__jsr_registry: string;
	export const npm_config_strict_peer_dependencies: string;
	export const npm_config_globalconfig: string;
	export const PWD: string;
	export const XAUTHORITY: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const VSCODE_INJECTION: string;
	export const HOME: string;
	export const LANG: string;
	export const npm_package_version: string;
	export const TURBO_IS_TUI: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const INIT_CWD: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const TURBO_HASH: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const USER: string;
	export const npm_config_frozen_lockfile: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const npm_config_user_agent: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_execpath: string;
	export const XDG_RUNTIME_DIR: string;
	export const NODE_PATH: string;
	export const npm_package_json: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const PATH: string;
	export const npm_config_node_gyp: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_config_registry: string;
	export const npm_node_execpath: string;
	export const TERM_PROGRAM: string;
	export const NODE_ENV: string;
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
	export const PUBLIC_EVAULT_SERVER_URI: string;
	export const PUBLIC_VERIFF_KEY: string;
	export const PUBLIC_REGISTRY_URL: string;
	export const PUBLIC_PROVISIONER_URL: string;
	export const PUBLIC_EID_WALLET_TOKEN: string;
	export const PUBLIC_PICTIQUE_URL: string;
	export const PUBLIC_PICTIQUE_BASE_URL: string;
	export const PUBLIC_BLABSY_URL: string;
	export const PUBLIC_BLABSY_BASE_URL: string;
	export const PUBLIC_GROUP_CHARTER_BASE_URL: string;
	export const PUBLIC_CERBERUS_BASE_URL: string;
	export const PUBLIC_EVOTING_BASE_URL: string;
	export const PUBLIC_EVOTING_URL: string;
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
		NEO4J_URI: string;
		NEO4J_USER: string;
		NEO4J_PASSWORD: string;
		REGISTRY_ENTROPY_KEY_JWK: string;
		ENCRYPTION_PASSWORD: string;
		W3ID: string;
		REGISTRY_DATABASE_URL: string;
		REGISTRY_SHARED_SECRET: string;
		PROVISIONER_DATABASE_URL: string;
		VERIFF_HMAC_KEY: string;
		DUPLICATES_POLICY: string;
		IP_ADDR: string;
		PICTIQUE_DATABASE_URL: string;
		PICTIQUE_MAPPING_DB_PATH: string;
		BLABSY_MAPPING_DB_PATH: string;
		DREAMSYNC_MAPPING_DB_PATH: string;
		GROUP_CHARTER_MAPPING_DB_PATH: string;
		CERBERUS_MAPPING_DB_PATH: string;
		GOOGLE_APPLICATION_CREDENTIALS: string;
		PICTIQUE_JWT_SECRET: string;
		GROUP_CHARTER_DATABASE_URL: string;
		CHARTER_JWT_SECRET: string;
		CERBERUS_DATABASE_URL: string;
		EVOTING_DATABASE_URL: string;
		EVOTING_MAPPING_DB_PATH: string;
		OPENAI_API_KEY: string;
		NOTIFICATION_SHARED_SECRET: string;
		DREAMSYNC_DATABASE_URL: string;
		VITE_DREAMSYNC_BASE_URL: string;
		EREPUTATION_DATABASE_URL: string;
		EREPUTATION_MAPPING_DB_PATH: string;
		VITE_EREPUTATION_BASE_URL: string;
		SHELL: string;
		npm_command: string;
		COLORTERM: string;
		npm_config_optional: string;
		npm_config_npm_globalconfig: string;
		NODE: string;
		npm_config_verify_deps_before_run: string;
		npm_config__jsr_registry: string;
		npm_config_strict_peer_dependencies: string;
		npm_config_globalconfig: string;
		PWD: string;
		XAUTHORITY: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		VSCODE_INJECTION: string;
		HOME: string;
		LANG: string;
		npm_package_version: string;
		TURBO_IS_TUI: string;
		pnpm_config_verify_deps_before_run: string;
		INIT_CWD: string;
		npm_lifecycle_script: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		TURBO_HASH: string;
		TERM: string;
		npm_package_name: string;
		USER: string;
		npm_config_frozen_lockfile: string;
		VSCODE_GIT_IPC_HANDLE: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		npm_config_user_agent: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_execpath: string;
		XDG_RUNTIME_DIR: string;
		NODE_PATH: string;
		npm_package_json: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		PATH: string;
		npm_config_node_gyp: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_config_registry: string;
		npm_node_execpath: string;
		TERM_PROGRAM: string;
		NODE_ENV: string;
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
		PUBLIC_EVAULT_SERVER_URI: string;
		PUBLIC_VERIFF_KEY: string;
		PUBLIC_REGISTRY_URL: string;
		PUBLIC_PROVISIONER_URL: string;
		PUBLIC_EID_WALLET_TOKEN: string;
		PUBLIC_PICTIQUE_URL: string;
		PUBLIC_PICTIQUE_BASE_URL: string;
		PUBLIC_BLABSY_URL: string;
		PUBLIC_BLABSY_BASE_URL: string;
		PUBLIC_GROUP_CHARTER_BASE_URL: string;
		PUBLIC_CERBERUS_BASE_URL: string;
		PUBLIC_EVOTING_BASE_URL: string;
		PUBLIC_EVOTING_URL: string;
		PUBLIC_APP_STORE_EID_WALLET: string;
		PUBLIC_PLAY_STORE_EID_WALLET: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
