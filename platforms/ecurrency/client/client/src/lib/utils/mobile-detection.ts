export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function getDeepLinkUrl(w3dsUrl: string): string {
  return w3dsUrl;
}

export function getAppStoreLink(): string {
		const userAgent =
			navigator.userAgent || navigator.vendor || (window as { opera?: string }).opera || '';
		if (/android/i.test(userAgent)) {
			return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
		}

		if (/iPad|iPhone|iPod/.test(userAgent) && !('MSStream' in window)) {
			return 'https://apps.apple.com/in/app/eid-for-w3ds/id6747748667';
		}

		return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
	}

