export function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] ?? 0;
    const v2Part = v2Parts[i] ?? 0;
    if (v1Part < v2Part) return -1;
    if (v1Part > v2Part) return 1;
  }
  return 0;
}

export function isVersionValid(
  appVersion: string,
  minVersion: string
): boolean {
  return compareVersions(appVersion, minVersion) >= 0;
}
