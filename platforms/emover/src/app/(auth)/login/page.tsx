"use client";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth-context";
import { setAuthToken, setAuthId } from "@/lib/authUtils";
import { apiClient } from "@/lib/apiClient";

export default function LoginPage() {
    const { login } = useAuth();
    const [qrData, setQrData] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchQRCode = async () => {
            try {
                const response = await apiClient.get("/api/auth/offer");
                const uri = response.data.uri;
                // Extract session from URI
                const url = new URL(uri);
                const session = url.searchParams.get("session");
                setQrData(uri);
                setSessionId(session);
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to fetch QR code:", error);
                setIsLoading(false);
            }
        };

        fetchQRCode();
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        const baseUrl = process.env.NEXT_PUBLIC_EMOVER_BASE_URL || "http://localhost:4000";
        const eventSource = new EventSource(
            `${baseUrl}/api/auth/sessions/${sessionId}`
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.error && data.type === "version_mismatch") {
                    setErrorMessage(
                        data.message ||
                            "Your eID Wallet app version is outdated. Please update to continue."
                    );
                    eventSource.close();
                    return;
                }

                if (data.token && data.user) {
                    setAuthToken(data.token);
                    setAuthId(data.user.id);
                    window.location.href = "/";
                }
            } catch (error) {
                console.error("Error parsing SSE data:", error);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId, login]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-screen px-4">
            <div className="flex flex-col items-center text-center gap-4">
                <h1 className="text-3xl font-bold">Emover</h1>
                <p className="text-muted-foreground">
                    Scan QR code with your eID Wallet to login
                </p>
            </div>

            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {errorMessage}
                </div>
            )}

            {qrData && (
                <div className="p-4 bg-white rounded-lg">
                    <QRCodeSVG value={qrData} size={256} />
                </div>
            )}

            <div className="text-sm text-muted-foreground text-center">
                Don't have the eID Wallet app?{" "}
                <a
                    href="https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                >
                    Download here
                </a>
            </div>
        </div>
    );
}

