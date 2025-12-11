import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";
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
          // Add a small delay to allow URL to fully parse before deciding
          await new Promise(resolve => setTimeout(resolve, 500));
          // Re-check one more time after delay
          const finalParams = new URLSearchParams(
            window.location.search ||
              (window.location.hash.includes('?')
                ? window.location.hash.substring(window.location.hash.indexOf('?') + 1)
                : '') ||
              ''
          );
          ename = finalParams.get('ename') || ename;
          session = finalParams.get('session') || session;
          signature = finalParams.get('signature') || signature;
          
          if (!ename || !session || !signature) {
            // If still missing, silently redirect to home/login to avoid flashing error
            window.location.href = "/";
            return;
          }
        }

        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);

        // Make POST request to login endpoint using axios (auto JSON parsing)
        const apiBaseUrl = import.meta.env.VITE_EREPUTATION_BASE_URL;
        const loginUrl = `${apiBaseUrl}/api/auth`;
        const requestBody = { ename, session, signature, appVersion: appVersion || '0.4.0' };

        try {
          const { data } = await apiClient.post(loginUrl, requestBody);
          if (data?.token && data?.user) {
            localStorage.setItem("ereputation_token", data.token);
            localStorage.setItem("ereputation_user_id", data.user.id);
            setTimeout(() => {
              window.location.href = "/";
            }, 100);
          } else {
            setError("Invalid response from server");
            setIsLoading(false);
          }
        } catch (err) {
          // If token already exists, silently continue to home
          const existingToken = localStorage.getItem("ereputation_token");
          if (existingToken) {
            window.location.href = "/";
            return;
          }
          console.error("Login request failed:", err);
          const axiosErr = err as any;
          const msg =
            axiosErr?.response?.data?.error ||
            axiosErr?.message ||
            "Failed to connect to server";
          setError(msg);
          setIsLoading(false);
        }
      } catch (error) {
        // If token already exists, silently continue to home
        const existingToken = localStorage.getItem("ereputation_token");
        if (existingToken) {
          window.location.href = "/";
          return;
        }
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
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}
