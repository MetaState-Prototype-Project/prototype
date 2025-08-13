"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import QRCode from "qrcode.react";
import { useAuth } from "@/lib/auth-context";
import { setAuthToken, setAuthId } from "@/lib/authUtils";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";

export default function LoginPage() {
    const { login } = useAuth();
    const [qrData, setQrData] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    useEffect(() => {
        const fetchQRCode = async () => {
            try {
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_EVOTING_BASE_URL}/api/auth/offer`,
                    { method: "GET", headers: { "Content-Type": "application/json" } }
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch QR code");
                }

                const data = await response.json();
                setQrData(data.offer);
                setSessionId(data.sessionId);
                setIsLoading(false);
            } catch {
                setError("Failed to load QR code");
                setIsLoading(false);
            }
        };

        fetchQRCode();
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        const eventSource = new EventSource(
            `${process.env.NEXT_PUBLIC_EVOTING_BASE_URL}/api/auth/sessions/${sessionId}`
        );

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.token && data.user) {
                setAuthToken(data.token);
                setAuthId(data.user.id);
                window.location.href = "/";
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId, login]);

    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-screen px-4 pb-safe">
            {/* Logo + Tagline */}
            <div className="flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <img src="/Logo.png" alt="eVoting Logo" className="h-12" />
                    eVoting
                </div>
                <p className="text-lg sm:text-2xl">Secure voting in the W3DS</p>
            </div>

            {/* Main Card */}
            <Card className="flex flex-col items-center gap-4 w-full max-w-md p-4 pt-2 mx-4">
                <CardHeader className="text-foreground text-xl sm:text-2xl font-black text-center">
                    Welcome to eVoting
                </CardHeader>

                <div className="flex flex-col gap-4 text-muted-foreground items-center text-center">
                    {/* Dynamic heading text */}
                    <div className="text-lg sm:text-xl space-x-1">
                        {isMobile ? (
                            <>
                                <span>Click the button below using your</span>
                                <span className="font-bold underline">eID App</span>
                                <span>to login</span>
                            </>
                        ) : (
                            <>
                                <span>Scan the QR using your</span>
                                <span className="font-bold underline">eID App</span>
                                <span>to login</span>
                            </>
                        )}
                    </div>

                    {error && <div className="w-full text-red-500">{error}</div>}

                    {isLoading ? (
                        <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="text-gray-500">Loading QR Code...</div>
                        </div>
                    ) : qrData ? (
                        <>
                            {isMobile ? (
                                <div className="flex flex-col gap-4 items-center">
                                    <a
                                        href={getDeepLinkUrl(qrData)}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                                    >
                                        Login with eID Wallet
                                    </a>
                                    <div className="text-xs text-gray-500 max-w-xs">
                                        Click the button to open your eID wallet app
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-white rounded-lg">
                                    <QRCode
                                        value={qrData}
                                        size={200}
                                        level="M"
                                        includeMargin={true}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                            <div className="text-gray-500">QR Code not available</div>
                        </div>
                    )}

                    {/* Expiry Note */}
                    <div>
                        <p className="font-bold text-md">
                            The code is only valid for 60 seconds
                        </p>
                        <p>Please refresh the page if it expires</p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-muted-foreground/20 p-4 rounded-md">
                        You are entering eVoting — a voting platform built on
                        the Web 3.0 Data Space (W3DS) architecture. This system
                        is designed around the principle of data-platform
                        separation, where all your personal content is stored in
                        your own sovereign eVault, not on centralised servers.
                    </div>
                </div>
            </Card>

            <img src="/W3DS.svg" alt="w3ds Logo" className="max-h-8" />
        </div>
    );
}
