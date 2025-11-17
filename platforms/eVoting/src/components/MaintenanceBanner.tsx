'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Motd {
    status: 'up' | 'maintenance';
    message: string;
}

const DISMISSED_KEY = 'maintenance-banner-dismissed';

export function MaintenanceBanner() {
    const [motd, setMotd] = useState<Motd | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const fetchMotd = async () => {
            try {
                const registryUrl = process.env.NEXT_PUBLIC_REGISTRY_URL || 'http://localhost:4321';
                const response = await axios.get<Motd>(`${registryUrl}/motd`);
                setMotd(response.data);
                
                // Check if this message has been dismissed
                if (response.data.status === 'maintenance') {
                    const dismissed = localStorage.getItem(DISMISSED_KEY);
                    setIsDismissed(dismissed === response.data.message);
                }
            } catch (error) {
                console.error('Failed to fetch motd:', error);
            }
        };

        fetchMotd();
    }, []);

    const dismissBanner = () => {
        if (motd?.message) {
            localStorage.setItem(DISMISSED_KEY, motd.message);
            setIsDismissed(true);
        }
    };

    if (motd?.status !== 'maintenance' || isDismissed) {
        return null;
    }

    return (
        <div className="relative bg-yellow-500 px-4 py-3 text-center text-sm font-medium text-black">
            <span>⚠️ {motd.message}</span>
            <button
                onClick={dismissBanner}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-700"
                aria-label="Dismiss banner"
            >
                <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    );
}

