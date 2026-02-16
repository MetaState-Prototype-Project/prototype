const MIN_REQUIRED_VERSION = "0.4.0";

export function isVersionValid(version: string, minVersion: string = MIN_REQUIRED_VERSION): boolean {
    const versionParts = version.split(".").map(Number);
    const minVersionParts = minVersion.split(".").map(Number);

    for (let i = 0; i < Math.max(versionParts.length, minVersionParts.length); i++) {
        const versionPart = versionParts[i] || 0;
        const minVersionPart = minVersionParts[i] || 0;

        if (versionPart > minVersionPart) return true;
        if (versionPart < minVersionPart) return false;
    }

    return true;
}

