export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Check for mobile devices
  if (/android/i.test(userAgent)) {
    return true;
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return true;
  }
  
  // Check screen size
  if (window.innerWidth <= 768) {
    return true;
  }
  
  return false;
}

export function getDeepLinkUrl(qrData: string): string {
  // Extract the deep link URL from the QR data
  // This assumes the QR data contains a URL that can be opened directly
  return qrData;
}

export function getAppStoreLink(): string {
  const defaultLink = "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
  
  if (typeof window === 'undefined') {
    return defaultLink;
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return "https://apps.apple.com/in/app/eid-for-w3ds/id6747748667";
  }
  
  return defaultLink;
}
