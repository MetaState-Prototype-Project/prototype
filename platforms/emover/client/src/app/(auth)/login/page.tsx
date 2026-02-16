"use client";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRightLeft } from "lucide-react";
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

        const baseUrl = process.env.NEXT_PUBLIC_EMOVER_BASE_URL || "http://localhost:4003";
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
    }, [sessionId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4">
            <div className="mb-5 flex flex-col items-center gap-2 text-center">
                <div className="mb-4">
                    <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-xl transform rotate-12">
                        <ArrowRightLeft className="w-10 h-10 text-white transform -rotate-12" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Emover</h1>
                <p className="text-gray-600">
                    Scan QR code with your eID Wallet to login
                </p>
            </div>

            <div className="mb-5 flex w-full max-w-[400px] flex-col items-center gap-5 rounded-xl bg-gray-100 p-5">
                <h2 className="text-gray-900">
                    Scan the QR code using your{" "}
                    <b>
                        <u className="text-sm">eID App</u>
                    </b>{" "}
                    to login
                </h2>
                {errorMessage && (
                    <div className="mb-4 rounded-lg border border-red-400 bg-red-100 p-4 text-red-700 w-full">
                        <p className="font-semibold">Authentication Error</p>
                        <p className="text-sm">{errorMessage}</p>
                    </div>
                )}
                {qrData && (
                    <article className="overflow-hidden rounded-2xl bg-white p-4">
                        <QRCodeSVG value={qrData} size={250} />
                    </article>
                )}
                <p className="text-center">
                    <span className="mb-1 block font-bold text-gray-600">
                        The code is valid for 60 seconds
                    </span>
                    <span className="block font-light text-gray-600">
                        Please refresh the page if it expires
                    </span>
                </p>
                <p className="w-full rounded-md bg-white/60 p-4 text-center text-xs leading-4 text-black/40">
                    You are entering Emover — an evault migration platform built
                    on the Web 3.0 Data Space (W3DS) architecture. Migrate your
                    evault to a new provider with your eID Wallet.
                </p>
            </div>

            <div className="text-sm text-gray-600 text-center">
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

