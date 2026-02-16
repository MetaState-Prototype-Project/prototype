export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
}

export function getDeepLinkUrl(qrData: string): string {
  return qrData;
}

export function createRevealDeepLink(pollId: string): string {
  return `w3ds://reveal?pollId=${pollId}`;
} 