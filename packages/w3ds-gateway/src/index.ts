/**
 * W3DS Gateway
 *
 * Resolve eNames to application URLs and present an app chooser.
 *
 * @example
 * ```ts
 * import { resolveEName, SchemaIds } from "w3ds-gateway";
 *
 * const result = await resolveEName({
 *   ename: "@user-uuid",
 *   schemaId: SchemaIds.SocialMediaPost,
 *   entityId: "post-123",
 * }, {
 *   registryUrl: "https://registry.w3ds.metastate.foundation",
 * });
 *
 * for (const app of result.apps) {
 *   console.log(`${app.platformName}: ${app.url}`);
 * }
 * ```
 */

export { resolveEName, resolveENameSync } from "./resolver.js";
export type { GatewayResolverOptions } from "./resolver.js";

export { SchemaIds, SchemaLabels } from "./schemas.js";
export type { SchemaId } from "./schemas.js";

export {
    PLATFORM_CAPABILITIES,
    PLATFORM_ENV_KEYS,
    REGISTRY_PLATFORM_KEY_ORDER,
    configurePlatformUrls,
    getPlatformUrls,
} from "./capabilities.js";

export { buildGatewayUri, buildGatewayData, buildGatewayLink } from "./notifications.js";
export type { GatewayLinkOptions, GatewayLinkData } from "./notifications.js";

export { PLATFORM_ICONS, FALLBACK_ICON } from "./icons.js";

// Re-export the modal web component for convenience (side-effect: registers <w3ds-gateway-chooser>)
export { W3dsGatewayChooser } from "./modal.js";

export type {
    Platform,
    PlatformHandler,
    ResolvedApp,
    GatewayResolveInput,
    GatewayResolveResult,
} from "./types.js";
