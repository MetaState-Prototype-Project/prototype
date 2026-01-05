
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
	export const GROUP_CHARTER_DATABASE_URL: string;
	export const CERBERUS_DATABASE_URL: string;
	export const EVOTING_DATABASE_URL: string;
	export const EVOTING_MAPPING_DB_PATH: string;
	export const OPENAI_API_KEY: string;
	export const NOTIFICATION_SHARED_SECRET: string;
	export const DREAMSYNC_DATABASE_URL: string;
	export const VITE_DREAMSYNC_BASE_URL: string;
	export const ECURRENCY_DATABASE_URL: string;
	export const ECURRENCY_MAPPING_DB_PATH: string;
	export const VITE_ECURRENCY_BASE_URL: string;
	export const JWT_SECRET: string;
	export const EREPUTATION_DATABASE_URL: string;
	export const EREPUTATION_MAPPING_DB_PATH: string;
	export const VITE_EREPUTATION_BASE_URL: string;
	export const ESIGNER_DATABASE_URL: string;
	export const ESIGNER_MAPPING_DB_PATH: string;
	export const FILE_MANAGER_DATABASE_URL: string;
	export const FILE_MANAGER_MAPPING_DB_PATH: string;
	export const LOAD_TEST_USER_COUNT: string;
	export const SHELL: string;
	export const LSCOLORS: string;
	export const npm_command: string;
	export const _ZO_DOCTOR: string;
	export const npm_config_optional: string;
	export const FNM_ARCH: string;
	export const COMPOSER_NO_INTERACTION: string;
	export const npm_config_npm_globalconfig: string;
	export const LANGUAGE: string;
	export const NODE: string;
	export const LC_ADDRESS: string;
	export const JAVA_HOME: string;
	export const VSCODE_PROCESS_TITLE: string;
	export const QT_LOGGING_RULES: string;
	export const LC_NAME: string;
	export const npm_config_verify_deps_before_run: string;
	export const npm_config__jsr_registry: string;
	export const CLOJURE_HOME: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const FNM_NODE_DIST_MIRROR: string;
	export const npm_config_strict_peer_dependencies: string;
	export const DESKTOP_SESSION: string;
	export const LC_MONETARY: string;
	export const ELECTRON_OZONE_PLATFORM_HINT: string;
	export const NO_AT_BRIDGE: string;
	export const npm_config_globalconfig: string;
	export const EDITOR: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const LOGNAME: string;
	export const XDG_SESSION_DESKTOP: string;
	export const QT_QPA_PLATFORMTHEME: string;
	export const XDG_SESSION_TYPE: string;
	export const VSCODE_ESM_ENTRYPOINT: string;
	export const SYSTEMD_EXEC_PID: string;
	export const VSCODE_CODE_CACHE_PATH: string;
	export const TERMINAL: string;
	export const QT_QPA_PLATFORMTHEME_QT6: string;
	export const DMS_SOCKET: string;
	export const MOTD_SHOWN: string;
	export const GDM_LANG: string;
	export const HOME: string;
	export const USERNAME: string;
	export const LANG: string;
	export const LC_PAPER: string;
	export const FNM_COREPACK_ENABLED: string;
	export const LS_COLORS: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_package_version: string;
	export const MESA_GLSL_CACHE_MAX_SIZE: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const VSCODE_IPC_HOOK: string;
	export const STARSHIP_SHELL: string;
	export const WAYLAND_DISPLAY: string;
	export const FORCE_COLOR: string;
	export const VSCODE_CLI: string;
	export const INVOCATION_ID: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const NIRI_SOCKET: string;
	export const MANAGERPID: string;
	export const DMS_DISABLE_HOT_RELOAD: string;
	export const INIT_CWD: string;
	export const CHROME_DESKTOP: string;
	export const STARSHIP_SESSION_KEY: string;
	export const QT_QPA_PLATFORM: string;
	export const npm_lifecycle_script: string;
	export const CURSOR_AGENT: string;
	export const XDG_SESSION_CLASS: string;
	export const ANDROID_HOME: string;
	export const TERM: string;
	export const LC_IDENTIFICATION: string;
	export const npm_package_name: string;
	export const ZSH: string;
	export const USER: string;
	export const npm_config_frozen_lockfile: string;
	export const NDK_HOME: string;
	export const EVERYSPHERE_RIPGREP_PATH: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const VSCODE_PID: string;
	export const SHLVL: string;
	export const PAGER: string;
	export const LC_TELEPHONE: string;
	export const npm_config_manage_package_manager_versions: string;
	export const LC_MEASUREMENT: string;
	export const VSCODE_CWD: string;
	export const FNM_VERSION_FILE_STRATEGY: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const NO_COLOR: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const npm_execpath: string;
	export const VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
	export const XDG_RUNTIME_DIR: string;
	export const FNM_RESOLVE_ENGINES: string;
	export const mesa_glthread: string;
	export const DMS_DEFAULT_LAUNCH_PREFIX: string;
	export const NODE_PATH: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_json: string;
	export const ELECTRON_NO_ATTACH_CONSOLE: string;
	export const JOURNAL_STREAM: string;
	export const GDK_BACKEND: string;
	export const PATH: string;
	export const npm_config_node_gyp: string;
	export const GDMSESSION: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const VSCODE_NLS_CONFIG: string;
	export const MAIL: string;
	export const npm_config_registry: string;
	export const MESA_SHADER_CACHE_DIR: string;
	export const FNM_DIR: string;
	export const FNM_MULTISHELL_PATH: string;
	export const npm_node_execpath: string;
	export const VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
	export const FNM_LOGLEVEL: string;
	export const OLDPWD: string;
	export const CURSOR_TRACE_ID: string;
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
	export const PUBLIC_ESIGNER_BASE_URL: string;
	export const PUBLIC_FILE_MANAGER_BASE_URL: string;
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
		GROUP_CHARTER_DATABASE_URL: string;
		CERBERUS_DATABASE_URL: string;
		EVOTING_DATABASE_URL: string;
		EVOTING_MAPPING_DB_PATH: string;
		OPENAI_API_KEY: string;
		NOTIFICATION_SHARED_SECRET: string;
		DREAMSYNC_DATABASE_URL: string;
		VITE_DREAMSYNC_BASE_URL: string;
		ECURRENCY_DATABASE_URL: string;
		ECURRENCY_MAPPING_DB_PATH: string;
		VITE_ECURRENCY_BASE_URL: string;
		JWT_SECRET: string;
		EREPUTATION_DATABASE_URL: string;
		EREPUTATION_MAPPING_DB_PATH: string;
		VITE_EREPUTATION_BASE_URL: string;
		ESIGNER_DATABASE_URL: string;
		ESIGNER_MAPPING_DB_PATH: string;
		FILE_MANAGER_DATABASE_URL: string;
		FILE_MANAGER_MAPPING_DB_PATH: string;
		LOAD_TEST_USER_COUNT: string;
		SHELL: string;
		LSCOLORS: string;
		npm_command: string;
		_ZO_DOCTOR: string;
		npm_config_optional: string;
		FNM_ARCH: string;
		COMPOSER_NO_INTERACTION: string;
		npm_config_npm_globalconfig: string;
		LANGUAGE: string;
		NODE: string;
		LC_ADDRESS: string;
		JAVA_HOME: string;
		VSCODE_PROCESS_TITLE: string;
		QT_LOGGING_RULES: string;
		LC_NAME: string;
		npm_config_verify_deps_before_run: string;
		npm_config__jsr_registry: string;
		CLOJURE_HOME: string;
		MEMORY_PRESSURE_WRITE: string;
		FNM_NODE_DIST_MIRROR: string;
		npm_config_strict_peer_dependencies: string;
		DESKTOP_SESSION: string;
		LC_MONETARY: string;
		ELECTRON_OZONE_PLATFORM_HINT: string;
		NO_AT_BRIDGE: string;
		npm_config_globalconfig: string;
		EDITOR: string;
		XDG_SEAT: string;
		PWD: string;
		LOGNAME: string;
		XDG_SESSION_DESKTOP: string;
		QT_QPA_PLATFORMTHEME: string;
		XDG_SESSION_TYPE: string;
		VSCODE_ESM_ENTRYPOINT: string;
		SYSTEMD_EXEC_PID: string;
		VSCODE_CODE_CACHE_PATH: string;
		TERMINAL: string;
		QT_QPA_PLATFORMTHEME_QT6: string;
		DMS_SOCKET: string;
		MOTD_SHOWN: string;
		GDM_LANG: string;
		HOME: string;
		USERNAME: string;
		LANG: string;
		LC_PAPER: string;
		FNM_COREPACK_ENABLED: string;
		LS_COLORS: string;
		XDG_CURRENT_DESKTOP: string;
		npm_package_version: string;
		MESA_GLSL_CACHE_MAX_SIZE: string;
		MEMORY_PRESSURE_WATCH: string;
		VSCODE_IPC_HOOK: string;
		STARSHIP_SHELL: string;
		WAYLAND_DISPLAY: string;
		FORCE_COLOR: string;
		VSCODE_CLI: string;
		INVOCATION_ID: string;
		pnpm_config_verify_deps_before_run: string;
		NIRI_SOCKET: string;
		MANAGERPID: string;
		DMS_DISABLE_HOT_RELOAD: string;
		INIT_CWD: string;
		CHROME_DESKTOP: string;
		STARSHIP_SESSION_KEY: string;
		QT_QPA_PLATFORM: string;
		npm_lifecycle_script: string;
		CURSOR_AGENT: string;
		XDG_SESSION_CLASS: string;
		ANDROID_HOME: string;
		TERM: string;
		LC_IDENTIFICATION: string;
		npm_package_name: string;
		ZSH: string;
		USER: string;
		npm_config_frozen_lockfile: string;
		NDK_HOME: string;
		EVERYSPHERE_RIPGREP_PATH: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		VSCODE_PID: string;
		SHLVL: string;
		PAGER: string;
		LC_TELEPHONE: string;
		npm_config_manage_package_manager_versions: string;
		LC_MEASUREMENT: string;
		VSCODE_CWD: string;
		FNM_VERSION_FILE_STRATEGY: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		NO_COLOR: string;
		PNPM_SCRIPT_SRC_DIR: string;
		npm_execpath: string;
		VSCODE_CRASH_REPORTER_PROCESS_TYPE: string;
		XDG_RUNTIME_DIR: string;
		FNM_RESOLVE_ENGINES: string;
		mesa_glthread: string;
		DMS_DEFAULT_LAUNCH_PREFIX: string;
		NODE_PATH: string;
		DEBUGINFOD_URLS: string;
		npm_package_json: string;
		ELECTRON_NO_ATTACH_CONSOLE: string;
		JOURNAL_STREAM: string;
		GDK_BACKEND: string;
		PATH: string;
		npm_config_node_gyp: string;
		GDMSESSION: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		VSCODE_NLS_CONFIG: string;
		MAIL: string;
		npm_config_registry: string;
		MESA_SHADER_CACHE_DIR: string;
		FNM_DIR: string;
		FNM_MULTISHELL_PATH: string;
		npm_node_execpath: string;
		VSCODE_HANDLES_UNCAUGHT_ERRORS: string;
		FNM_LOGLEVEL: string;
		OLDPWD: string;
		CURSOR_TRACE_ID: string;
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
		PUBLIC_ESIGNER_BASE_URL: string;
		PUBLIC_FILE_MANAGER_BASE_URL: string;
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
