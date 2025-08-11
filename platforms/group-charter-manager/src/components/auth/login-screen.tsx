"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { apiClient } from "@/lib/apiClient";
import { setAuthToken, setAuthId } from "@/lib/authUtils";
import { useRouter } from "next/navigation";
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
            const { data } = await apiClient.get("/api/auth/offer");
            setQrData(data.uri);
            setIsLoading(false);

            // Start watching for authentication
            const sessionId = new URL(data.uri).searchParams.get("session");
            if (sessionId) {
                watchEventStream(sessionId);
            }
        } catch (error) {
            console.error("Failed to get auth offer:", error);
            setIsLoading(false);
        }
    };

    const watchEventStream = (sessionId: string) => {
        const baseUrl =
            process.env.NEXT_PUBLIC_GROUP_CHARTER_BASE_URL ||
            "http://localhost:3001";
        const sseUrl = `${baseUrl}/api/auth/sessions/${sessionId}`;
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
            console.log("Successfully connected to auth stream.");
        };

        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            console.log("Auth data received:", data);

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
            console.error("EventSource error:", error);
            eventSource.close();
        };
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
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
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Group Charter Manager
                    </h1>
                    <p className="text-gray-600">
                        Scan the QR code to login with your W3DS identity
                    </p>
                </div>

                {qrData && (
                    <div className="flex justify-center mb-6">
                        <div className="bg-white p-4 rounded-lg border">
                            <QRCodeSVG
                                value={qrData}
                                size={200}
                                level="M"
                                includeMargin={true}
                            />
                        </div>
                    </div>
                )}

                <div className="text-center">
                    <p className="text-sm text-gray-500">
                        Use your W3DS wallet to scan this QR code and
                        authenticate
                    </p>
                </div>
                <p className="p-4 rounded-xl bg-gray-100 text-gray-700 mt-4">
                    You are entering Group Charter - a group charter management
                    platform built on the Web 3.0 Data Space (W3DS)
                    architecture. This system is designed around the principle
                    of data-platform separation, where all your personal content
                    is stored in your own sovereign eVault, not on centralised
                    servers.
                </p>
                <Image
                    src="/W3DS.svg"
                    alt="W3DS Logo"
                    width={50}
                    height={20}
                    className="mx-auto mt-5"
                />
            </div>
        </div>
    );
}
