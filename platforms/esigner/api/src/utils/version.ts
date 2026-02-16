/**
 * Compares two semantic version strings
 * @param version1 - First version string (e.g., "0.4.0")
 * @param version2 - Second version string (e.g., "0.3.0")
 * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;

        if (v1Part < v2Part) return -1;
        if (v1Part > v2Part) return 1;
    }

    return 0;
}

/**
 * Checks if the app version meets the minimum required version
 * @param appVersion - The version from the app (e.g., "0.4.0")
 * @param minVersion - The minimum required version (e.g., "0.4.0")
 * @returns true if appVersion >= minVersion, false otherwise
 */
export function isVersionValid(appVersion: string, minVersion: string): boolean {
    return compareVersions(appVersion, minVersion) >= 0;
}


