'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { isUsingEmulator } from '@lib/env';

/**
 * Local-dev only sign-in: bypasses the QR / eID-wallet flow by accepting a
 * Firebase custom token in the URL. Mint one with the api seedEmulator script.
 *
 *   /dev-login?token=<custom-token>
 *
 * Disabled unless running against the Firebase emulators.
 */
export default function DevLogin(): JSX.Element {
    const { signInWithCustomToken, user } = useAuth();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isUsingEmulator) {
            setError('dev-login is only available in emulator mode.');
            return;
        }
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) {
            setError('Missing ?token= parameter.');
            return;
        }
        void signInWithCustomToken(token);
    }, [signInWithCustomToken]);

    useEffect(() => {
        if (user) void router.push('/home');
    }, [user, router]);

    return (
        <div className='flex h-screen items-center justify-center'>
            {error ? (
                <p className='text-red-600'>{error}</p>
            ) : (
                <p className='text-gray-600'>Signing in…</p>
            )}
        </div>
    );
}
