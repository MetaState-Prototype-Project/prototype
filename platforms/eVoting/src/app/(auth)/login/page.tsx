"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth-context";
import { setAuthToken, setAuthId } from "@/lib/authUtils";
import { isMobileDevice, getDeepLinkUrl } from "@/lib/utils/mobile-detection";

export default function LoginPage() {
    const { login } = useAuth();
    const [qrData, setQrData] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [redirectTo, setRedirectTo] = useState<string>("/");


    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    // Check for query parameters and auto-login
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
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

        if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
        setRedirectTo(redirect);
        sessionStorage.setItem("postLoginRedirect", redirect);
    }

        // If no query params, proceed with normal flow
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

    const handleAutoLogin = async (ename: string, session: string, signature: string, appVersion: string) => {
        setIsLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_EVOTING_BASE_URL;
            if (!baseUrl) {
                console.error('NEXT_PUBLIC_EVOTING_BASE_URL not configured');
                setIsLoading(false);
                return;
            }

            const response = await fetch(`${baseUrl}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ename, session, signature, appVersion })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token && data.user) {
                    setAuthToken(data.token);
                    setAuthId(data.user.id);
                    const redirect =
    sessionStorage.getItem("postLoginRedirect") || redirectTo || "/";

sessionStorage.removeItem("postLoginRedirect");
window.location.href = redirect;
                }
            } else {
                const errorData = await response.json();
                console.error('Login failed:', errorData);
                if (errorData.error && errorData.type === 'version_mismatch') {
                    setErrorMessage(errorData.message || 'Your eID Wallet app version is outdated. Please update to continue.');
                }
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Login request failed:', error);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!sessionId) return;

        const eventSource = new EventSource(
            `${process.env.NEXT_PUBLIC_EVOTING_BASE_URL}/api/auth/sessions/${sessionId}`
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
                if (data.token && data.user) {
                    setAuthToken(data.token);
                    setAuthId(data.user.id);
                    const redirect =
    sessionStorage.getItem("postLoginRedirect") || redirectTo || "/";

sessionStorage.removeItem("postLoginRedirect");
window.location.href = redirect;
                }
            } catch (error) {
                console.error("Error parsing SSE data:", error);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId, login, redirectTo]);

    const getAppStoreLink = () => {
        if (typeof navigator === 'undefined') return "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(userAgent)) {
            return "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
        }
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return "https://apps.apple.com/in/app/eid-for-w3ds/id6747748667"
        }
        return "https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet";
    };

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
                                <span>Click the button below using you</span>
                                <a href={getAppStoreLink()}><span className="font-bold underline">eID App</span></a>
                                <span>to login</span>
                            </>
                        ) : (
                            <>
                                <span>Scan the QR using your</span>
                                <a href={getAppStoreLink()}><span className="font-bold underline">eID App</span></a>
                                <span>to login</span>
                            </>
                        )}
                    </div>

                    {error && <div className="w-full text-red-500">{error}</div>}
                    
                    {errorMessage && (
                        <div className="w-full mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                            <p className="font-semibold">Authentication Error</p>
                            <p className="text-sm">{errorMessage}</p>
                        </div>
                    )}

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
                                    <QRCodeSVG
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
            <a href="https://metastate.foundation" target="_blank" rel="noopener noreferrer">
                <img src="/W3DS.svg" alt="w3ds Logo" className="max-h-8" />
            </a>
        </div>
    );
}