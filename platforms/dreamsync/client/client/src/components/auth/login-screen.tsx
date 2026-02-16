import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";
import { isMobileDevice, getDeepLinkUrl, getAppStoreLink } from "@/lib/utils/mobile-detection";
import { Heart } from "lucide-react";

export function LoginScreen() {
  const { login } = useAuth();
  const [qrCode, setQrCode] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for query parameters and auto-login
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ename = params.get('ename');
    const session = params.get('session');
    const signature = params.get('signature');
    const appVersion = params.get('appVersion');

    if (ename && session && signature) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Auto-submit login
      handleAutoLogin(ename, session, signature, appVersion || '0.4.0');
      return;
    }

    // If no query params, proceed with normal flow
    const getAuthOffer = async () => {
      try {
        console.log("🔍 Getting auth offer from:", apiClient.defaults.baseURL);
        const response = await apiClient.get("/api/auth/offer");
        console.log("✅ Auth offer response:", response.data);
        setQrCode(response.data.offer);
        setSessionId(response.data.sessionId);
        setIsLoading(false);
      } catch (error) {
        console.error("❌ Failed to get auth offer:", error);
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: unknown; status?: number } };
          console.error("❌ Error details:", axiosError.response?.data);
          console.error("❌ Error status:", axiosError.response?.status);
        }
        setIsLoading(false);
      }
    };

    getAuthOffer();
  }, []);

  const handleAutoLogin = async (ename: string, session: string, signature: string, appVersion: string) => {
    setIsConnecting(true);
    try {
      const apiBaseUrl = import.meta.env.VITE_DREAMSYNC_BASE_URL || "http://localhost:8888";
      const response = await fetch(`${apiBaseUrl}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ename, session, signature, appVersion })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && data.user) {
          localStorage.setItem("dreamsync_token", data.token);
          localStorage.setItem("dreamsync_user_id", data.user.id);
          window.location.href = "/";
        }
      } else {
        const errorData = await response.json();
        console.error('Login failed:', errorData);
        if (errorData.error && errorData.type === 'version_mismatch') {
          setErrorMessage(errorData.message || 'Your eID Wallet app version is outdated. Please update to continue.');
        }
        setIsConnecting(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login request failed:', error);
      setIsConnecting(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_DREAMSYNC_BASE_URL || "http://localhost:8888"}/api/auth/sessions/${sessionId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check for error messages (version mismatch)
        if (data.error && data.type === 'version_mismatch') {
          setErrorMessage(data.message || 'Your eID Wallet app version is outdated. Please update to continue.');
          eventSource.close();
          return;
        }

        // Handle successful authentication
        if (data.user && data.token) {
          setIsConnecting(true);
          // Store the token and user ID directly
          localStorage.setItem("dreamsync_token", data.token);
          localStorage.setItem("dreamsync_user_id", data.user.id);
          // Redirect to home page
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, login]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (isConnecting) {
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
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 rounded-xl flex items-center justify-center shadow-sm">
            <Heart className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">DreamSync</h1>
        </div>
        <p className="text-gray-600">
          Connect your dreams in the MetaState
        </p>
      </div>
      
      <div className="bg-white/50 p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <p className="text-gray-600">
            Scan the QR code using your <a href={getAppStoreLink()}><b><u>eID App</u></b></a> to login
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Authentication Error</p>
            <p className="text-sm">{errorMessage}</p>
          </div>
        )}

        {qrCode && (
          <div className="flex justify-center mb-6">
            {isMobileDevice() ? (
              <div className="flex flex-col gap-4 items-center">
                <a
                  href={getDeepLinkUrl(qrCode)}
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
                  value={qrCode}
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
            <span className="mb-1 block font-bold text-gray-600">The {isMobileDevice() ? "button" : "code"} is valid for 60 seconds</span>
            <span className="block font-light text-gray-600">Please refresh the page if it expires</span>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-100 text-gray-700 mt-4">
          You are entering DreamSync - an AI-powered wishlist matching and collaboration
          platform built on the Web 3.0 Data Space (W3DS)
          architecture. This system is designed around the principle
          of data-platform separation, where all your personal content
          is stored in your own sovereign eVault, not on centralised
          servers.
        </div>

        <a href="https://metastate.foundation" target="_blank" rel="noopener noreferrer">
          <img
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
