"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { apiClient } from "@/lib/apiClient";
import { setAuthToken, setAuthId } from "@/lib/authUtils";
import { useRouter } from "next/navigation";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";
import Image from "next/image";

export default function LoginScreen() {
  const [qrData, setQrData] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const { data } = await apiClient.get('/api/auth/offer');
      setQrData(data.uri);
      setIsLoading(false);

      // Start watching for authentication
      const sessionId = new URL(data.uri).searchParams.get('session');
      if (sessionId) {
        watchEventStream(sessionId);
      }
    } catch (error) {
      console.error('Failed to get auth offer:', error);
      setIsLoading(false);
    }
  };

  const watchEventStream = (sessionId: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_GROUP_CHARTER_BASE_URL || 'http://localhost:3001';
    const sseUrl = `${baseUrl}/api/auth/sessions/${sessionId}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log('Successfully connected to auth stream.');
    };

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log('Auth data received:', data);

      const { user, token } = data;

      // Set authentication data
      setAuthId(user.id);
      setAuthToken(token);

      // Close the event source
      eventSource.close();

      // Set authenticating state
      setIsAuthenticating(true);

      // Force a page refresh to trigger AuthProvider re-initialization
      window.location.reload();
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
    };
  };

  const getAppStoreLink = () => {
			const userAgent = navigator.userAgent || navigator.vendor || window.opera;
			if (/android/i.test(userAgent)) {
				return "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
			}
			if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
				return "https://apps.apple.com/in/app/eid-for-w3ds/id6747748667"
			}
			return "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
		};

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (isAuthenticating) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-h-screen items-center justify-center p-4">
        <div className="flex flex-col gap-2 items-center justify-center">
            <div className="flex gap-4 justify-center items-center">
                <Image
                    src="/logo.png"
                    alt="Group Charter Manager Logo"
                    width={50}
                    height={50}
                />
                <h1 className="text-3xl font-bold">Group Charter</h1>
            </div>
            <p className="text-gray-600">
                Coordinate your group in the MetaState
            </p>
        </div>
      <div className="bg-white/50 p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">

          <p className="text-gray-600">
            Scan the QR code using your <a href={getAppStoreLink()}><b><u>eID App</u></b></a> to login
          </p>
        </div>

        {qrData && (
          <div className="flex justify-center mb-6">
            {isMobileDevice() ? (
              <div className="flex flex-col gap-4 items-center">
                <a
                  href={getDeepLinkUrl(qrData)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  Login with eID Wallet
                </a>
                <div className="text-xs text-gray-500 text-center max-w-xs">
                  Click the button to open your eID wallet app
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg border">
                <QRCodeSVG
                  value={qrData}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
            )}
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-gray-500">
           <span className="mb-1 block font-bold text-gray-600">The {isMobileDevice() ? "button": "code"} is valid for 60 seconds</span>
			<span className="block font-light text-gray-600">Please refresh the page if it expires</span
			>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-100 text-gray-700 mt-4">
          You are entering Group Charter - a group charter management
          platform built on the Web 3.0 Data Space (W3DS)
          architecture. This system is designed around the principle
          of data-platform separation, where all your personal content
          is stored in your own sovereign eVault, not on centralised
          servers.
        </div>

        <a href="https://metastate.foundation" target="_blank" rel="noopener noreferrer">
            <Image
            src="/W3DS.svg"
            alt="W3DS Logo"
            width={50}
            height={20}
            className="mx-auto mt-5"
            />
        </a>
      </div>
    </div>
  );
}
