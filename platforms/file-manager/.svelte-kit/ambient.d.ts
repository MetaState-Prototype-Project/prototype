
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
	export const W3ID: string;
	export const REGISTRY_DATABASE_URL: string;
	export const REGISTRY_SHARED_SECRET: string;
	export const PROVISIONER_DATABASE_URL: string;
	export const VERIFF_HMAC_KEY: string;
	export const DUPLICATES_POLICY: string;
	export const IP_ADDR: string;
	export const PICTIQUE_DATABASE_URL: string;
	export const PICTIQUE_MAPPING_DB_PATH: string;
	export const OPENAI_API_KEY: string;
	export const NOTIFICATION_SHARED_SECRET: string;
	export const EMOVER_DATABASE_URL: string;
	export const LOKI_URL: string;
	export const LOKI_USERNAME: string;
	export const LOKI_PASSWORD: string;
	export const PROVISIONER_URLS: string;
	export const SHELL: string;
	export const npm_command: string;
	export const SESSION_MANAGER: string;
	export const COLORTERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const XDG_SESSION_PATH: string;
	export const XDG_MENU_PREFIX: string;
	export const TERM_PROGRAM_VERSION: string;
	export const npm_config_optional: string;
	export const FNM_ARCH: string;
	export const npm_config_npm_globalconfig: string;
	export const ICEAUTHORITY: string;
	export const NODE: string;
	export const LC_ADDRESS: string;
	export const JAVA_HOME: string;
	export const LC_NAME: string;
	export const SSH_AUTH_SOCK: string;
	export const npm_config_verify_deps_before_run: string;
	export const npm_config__jsr_registry: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const FNM_NODE_DIST_MIRROR: string;
	export const npm_config_strict_peer_dependencies: string;
	export const LIBVA_DRIVER_NAME: string;
	export const DESKTOP_SESSION: string;
	export const LC_MONETARY: string;
	export const SSH_AGENT_PID: string;
	export const GTK_RC_FILES: string;
	export const NO_AT_BRIDGE: string;
	export const npm_config_globalconfig: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const XDG_SESSION_DESKTOP: string;
	export const LOGNAME: string;
	export const XDG_SESSION_TYPE: string;
	export const SYSTEMD_EXEC_PID: string;
	export const XAUTHORITY: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const MOTD_SHOWN: string;
	export const VSCODE_INJECTION: string;
	export const GTK2_RC_FILES: string;
	export const HOME: string;
	export const LC_PAPER: string;
	export const LANG: string;
	export const FNM_COREPACK_ENABLED: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_package_version: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const WAYLAND_DISPLAY: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const MANROFFOPT: string;
	export const GIT_ASKPASS: string;
	export const XDG_SEAT_PATH: string;
	export const VSCODE_GIT_IPC_AUTH_TOKEN: string;
	export const INVOCATION_ID: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const MANAGERPID: string;
	export const INIT_CWD: string;
	export const CHROME_DESKTOP: string;
	export const KDE_SESSION_UID: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const XDG_SESSION_CLASS: string;
	export const ANDROID_HOME: string;
	export const LC_IDENTIFICATION: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const USER: string;
	export const npm_config_frozen_lockfile: string;
	export const NDK_HOME: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const KDE_SESSION_VERSION: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const MANPAGER: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const LC_TELEPHONE: string;
	export const LC_MEASUREMENT: string;
	export const FNM_VERSION_FILE_STRATEGY: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_execpath: string;
	export const XDG_RUNTIME_DIR: string;
	export const FNM_RESOLVE_ENGINES: string;
	export const NODE_PATH: string;
	export const DEBUGINFOD_URLS: string;
	export const LC_TIME: string;
	export const npm_package_json: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const JOURNAL_STREAM: string;
	export const KDE_FULL_SESSION: string;
	export const GDK_BACKEND: string;
	export const PATH: string;
	export const npm_config_node_gyp: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const MAIL: string;
	export const npm_config_registry: string;
	export const FNM_DIR: string;
	export const FNM_MULTISHELL_PATH: string;
	export const npm_node_execpath: string;
	export const FNM_LOGLEVEL: string;
	export const LC_NUMERIC: string;
	export const TERM_PROGRAM: string;
	export const CURSOR_TRACE_ID: string;
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
	export const PUBLIC_PICTIQUE_URL: string;
	export const PUBLIC_PICTIQUE_BASE_URL: string;
	export const PUBLIC_APP_STORE_EID_WALLET: string;
	export const PUBLIC_PLAY_STORE_EID_WALLET: string;
	export const PUBLIC_EID_WALLET_TOKEN: string;
	export const PUBLIC_EMOVER_BASE_URL: string;
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
		W3ID: string;
		REGISTRY_DATABASE_URL: string;
		REGISTRY_SHARED_SECRET: string;
		PROVISIONER_DATABASE_URL: string;
		VERIFF_HMAC_KEY: string;
		DUPLICATES_POLICY: string;
		IP_ADDR: string;
		PICTIQUE_DATABASE_URL: string;
		PICTIQUE_MAPPING_DB_PATH: string;
		OPENAI_API_KEY: string;
		NOTIFICATION_SHARED_SECRET: string;
		EMOVER_DATABASE_URL: string;
		LOKI_URL: string;
		LOKI_USERNAME: string;
		LOKI_PASSWORD: string;
		PROVISIONER_URLS: string;
		SHELL: string;
		npm_command: string;
		SESSION_MANAGER: string;
		COLORTERM: string;
		XDG_CONFIG_DIRS: string;
		XDG_SESSION_PATH: string;
		XDG_MENU_PREFIX: string;
		TERM_PROGRAM_VERSION: string;
		npm_config_optional: string;
		FNM_ARCH: string;
		npm_config_npm_globalconfig: string;
		ICEAUTHORITY: string;
		NODE: string;
		LC_ADDRESS: string;
		JAVA_HOME: string;
		LC_NAME: string;
		SSH_AUTH_SOCK: string;
		npm_config_verify_deps_before_run: string;
		npm_config__jsr_registry: string;
		MEMORY_PRESSURE_WRITE: string;
		FNM_NODE_DIST_MIRROR: string;
		npm_config_strict_peer_dependencies: string;
		LIBVA_DRIVER_NAME: string;
		DESKTOP_SESSION: string;
		LC_MONETARY: string;
		SSH_AGENT_PID: string;
		GTK_RC_FILES: string;
		NO_AT_BRIDGE: string;
		npm_config_globalconfig: string;
		XDG_SEAT: string;
		PWD: string;
		XDG_SESSION_DESKTOP: string;
		LOGNAME: string;
		XDG_SESSION_TYPE: string;
		SYSTEMD_EXEC_PID: string;
		XAUTHORITY: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		MOTD_SHOWN: string;
		VSCODE_INJECTION: string;
		GTK2_RC_FILES: string;
		HOME: string;
		LC_PAPER: string;
		LANG: string;
		FNM_COREPACK_ENABLED: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		XDG_CURRENT_DESKTOP: string;
		npm_package_version: string;
		MEMORY_PRESSURE_WATCH: string;
		WAYLAND_DISPLAY: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		MANROFFOPT: string;
		GIT_ASKPASS: string;
		XDG_SEAT_PATH: string;
		VSCODE_GIT_IPC_AUTH_TOKEN: string;
		INVOCATION_ID: string;
		pnpm_config_verify_deps_before_run: string;
		MANAGERPID: string;
		INIT_CWD: string;
		CHROME_DESKTOP: string;
		KDE_SESSION_UID: string;
		npm_lifecycle_script: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		XKB_DEFAULT_LAYOUT: string;
		XDG_SESSION_CLASS: string;
		ANDROID_HOME: string;
		LC_IDENTIFICATION: string;
		TERM: string;
		npm_package_name: string;
		USER: string;
		npm_config_frozen_lockfile: string;
		NDK_HOME: string;
		VSCODE_GIT_IPC_HANDLE: string;
		QT_WAYLAND_RECONNECT: string;
		KDE_SESSION_VERSION: string;
		PAM_KWALLET5_LOGIN: string;
		MANPAGER: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		LC_TELEPHONE: string;
		LC_MEASUREMENT: string;
		FNM_VERSION_FILE_STRATEGY: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_execpath: string;
		XDG_RUNTIME_DIR: string;
		FNM_RESOLVE_ENGINES: string;
		NODE_PATH: string;
		DEBUGINFOD_URLS: string;
		LC_TIME: string;
		npm_package_json: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		JOURNAL_STREAM: string;
		KDE_FULL_SESSION: string;
		GDK_BACKEND: string;
		PATH: string;
		npm_config_node_gyp: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		MAIL: string;
		npm_config_registry: string;
		FNM_DIR: string;
		FNM_MULTISHELL_PATH: string;
		npm_node_execpath: string;
		FNM_LOGLEVEL: string;
		LC_NUMERIC: string;
		TERM_PROGRAM: string;
		CURSOR_TRACE_ID: string;
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
		PUBLIC_PICTIQUE_URL: string;
		PUBLIC_PICTIQUE_BASE_URL: string;
		PUBLIC_APP_STORE_EID_WALLET: string;
		PUBLIC_PLAY_STORE_EID_WALLET: string;
		PUBLIC_EID_WALLET_TOKEN: string;
		PUBLIC_EMOVER_BASE_URL: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
