"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode.react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/apiClient";

export function LoginScreen() {
  const { login } = useAuth();
  const [qrCode, setQrCode] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const getAuthOffer = async () => {
      try {
        const response = await apiClient.get("/api/auth/offer");
        setQrCode(response.data.uri);
        setSessionId(response.data.uri.split("session=")[1]?.split("&")[0] || "");
      } catch (error) {
        console.error("Failed to get auth offer:", error);
      }
    };

    getAuthOffer();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_EVOTING_BASE_URL || "http://localhost:4000"}/api/auth/sessions/${sessionId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.user && data.token) {
          setIsConnecting(true);
          // Store the token and user ID directly
          localStorage.setItem("evoting_token", data.token);
          localStorage.setItem("evoting_user_id", data.user.id);
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
            Sign in to eVoting
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Scan the QR code with your W3DS wallet to authenticate
          </p>
        </div>
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="flex flex-col items-center space-y-6">
            {qrCode ? (
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                <QRCode
                  value={qrCode}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
            ) : (
              <div className="w-52 h-52 bg-gray-200 rounded-lg animate-pulse flex items-center justify-center">
                <span className="text-gray-500">Loading QR Code...</span>
              </div>
            )}
            
            {isConnecting && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Connecting...</p>
              </div>
            )}
            
            <div className="text-center text-sm text-gray-500">
              <p>Don't have a W3DS wallet?</p>
              <p>Download one to get started with decentralized identity</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 