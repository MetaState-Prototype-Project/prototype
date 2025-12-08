export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getDeepLinkUrl(w3dsUrl: string): string {
  return w3dsUrl;
}

export function getAppStoreLink(): string {
  return "https://apps.apple.com/app/eid-wallet";
}

