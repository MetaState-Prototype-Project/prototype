import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/apiClient";

export function LoginScreen() {
  const { login } = useAuth();
  const [qrCode, setQrCode] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const getAuthOffer = async () => {
      try {
        console.log("🔍 Getting auth offer from:", apiClient.defaults.baseURL);
        const response = await apiClient.get("/api/auth/offer");
        console.log("✅ Auth offer response:", response.data);
        setQrCode(response.data.offer);
        setSessionId(response.data.sessionId);
      } catch (error) {
        console.error("❌ Failed to get auth offer:", error);
        console.error("❌ Error details:", error.response?.data);
        console.error("❌ Error status:", error.response?.status);
      }
    };

    getAuthOffer();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_DREAMSYNC_BASE_URL || "http://localhost:8888"}/api/auth/sessions/${sessionId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to DreamSync
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Scan the QR code with your eID wallet to authenticate
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="flex justify-center">
            {qrCode ? (
              <div className="p-4 bg-white rounded-lg shadow-lg">
                <QRCodeSVG value={qrCode} size={256} />
              </div>
            ) : (
              <div className="p-4 bg-white rounded-lg shadow-lg w-64 h-64 flex items-center justify-center">
                <div className="text-gray-500">Loading QR code...</div>
              </div>
            )}
          </div>
          
          {isConnecting && (
            <div className="text-center">
              <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-blue-500 hover:bg-blue-400 transition ease-in-out duration-150 cursor-not-allowed">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </div>
            </div>
          )}
          
          <div className="text-center text-sm text-gray-600">
            <p>Don't have an eID wallet?</p>
            <p className="mt-1">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                Download eID wallet
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
