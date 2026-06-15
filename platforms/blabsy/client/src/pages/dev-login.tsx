'use client';

import { useEffect, useRef, useState } from 'react';
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
    const attempted = useRef(false);

    useEffect(() => {
        // Attempt sign-in exactly once. signInWithCustomToken changes identity
        // every render (and a failed attempt re-renders via setError), so the
        // ref guard prevents an infinite retry loop while keeping the dep listed.
        if (attempted.current) return;
        attempted.current = true;

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
