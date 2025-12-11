import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function DeeplinkLogin() {
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleDeeplinkLogin = async () => {
            try {
                // Try parsing from search string first
                let params: URLSearchParams;
                let searchString = window.location.search;

                // If search is empty, try parsing from hash or full URL
                if (!searchString || searchString === '') {
                    const hash = window.location.hash;
                    if (hash && hash.includes('?')) {
                        searchString = hash.substring(hash.indexOf('?'));
                    } else {
                        try {
                            const fullUrl = new URL(window.location.href);
                            searchString = fullUrl.search;
                        } catch (e) {
                            // Ignore parsing errors
                        }
                    }
                }

                // Remove leading ? if present
                if (searchString.startsWith('?')) {
                    searchString = searchString.substring(1);
                }

                // Parse the search string
                params = new URLSearchParams(searchString);

                let ename = params.get('ename');
                let session = params.get('session');
                let signature = params.get('signature');
                const appVersion = params.get('appVersion');

                if (!ename || !session || !signature) {
                    // Add a small delay to allow URL to fully parse before showing error
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // Re-check one more time after delay
                    const finalParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.substring(window.location.hash.indexOf('?') + 1) : '') || '');
                    ename = finalParams.get('ename') || ename;
                    session = finalParams.get('session') || session;
                    signature = finalParams.get('signature') || signature;

                if (!ename || !session || !signature) {
                    setError("Missing required authentication parameters");
                    setIsLoading(false);
                    return;
                    }
                }

                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);

                // Make POST request to login endpoint
                const apiBaseUrl = import.meta.env.VITE_ECURRENCY_BASE_URL;
                const loginUrl = `${apiBaseUrl}/api/auth`;
                const requestBody = { ename, session, signature, appVersion: appVersion || '0.4.0' };

                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.token && data.user) {
                        localStorage.setItem("ecurrency_token", data.token);
                        localStorage.setItem("ecurrency_user", JSON.stringify(data.user));
                        window.location.href = "/dashboard";
                    } else {
                        setError("Invalid response from server");
                        setIsLoading(false);
                    }
                } else {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (parseError) {
                        errorData = { error: `Server error: ${response.status}` };
                    }
                    setError(errorData.error || "Authentication failed");
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Login request failed:', error);
                setError("Failed to connect to server");
                setIsLoading(false);
            }
        };

        handleDeeplinkLogin();
    }, []);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 mb-4">{error}</div>
                    <button
                        onClick={() => window.location.href = "/"}
                        className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
