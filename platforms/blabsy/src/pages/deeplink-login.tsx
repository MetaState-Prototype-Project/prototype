'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';

export default function DeeplinkLogin(): JSX.Element | null {
    const { signInWithCustomToken, user } = useAuth();
    const router = useRouter();
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

                const ename = params.get('ename');
                const session = params.get('session');
                const signature = params.get('signature');
                const appVersion = params.get('appVersion');

                if (!ename || !session || !signature) {
                    setError('Missing required authentication parameters');
                    setIsLoading(false);
                    return;
                }

                // Clean up URL
                window.history.replaceState({}, '', window.location.pathname);

                // Make POST request to login endpoint
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
                if (!baseUrl) {
                    setError('Server configuration error');
                    setIsLoading(false);
                    return;
                }

                const loginUrl = `${baseUrl}/api/auth`;
                const requestBody = {
                    ename,
                    session,
                    signature,
                    appVersion: appVersion || '0.4.0'
                };

                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    // Blabsy API returns { token } only (Firebase custom token)
                    if (data.token) {
                        await signInWithCustomToken(data.token);
                        // Navigation will happen via auth state change, but ensure we navigate
                        router.push('/home').catch(() => {
                            // If push fails, try replace
                            router.replace('/home').catch(() => {
                                window.location.href = '/home';
                            });
                        });
                    } else {
                        setError('Invalid response from server');
                        setIsLoading(false);
                    }
                } else {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (parseError) {
                        errorData = {
                            error: `Server error: ${response.status}`
                        };
                    }
                    setError(errorData.error || 'Authentication failed');
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Login request failed:', error);
                setError('Failed to connect to server');
                setIsLoading(false);
            }
        };

        handleDeeplinkLogin();
    }, [signInWithCustomToken, router]);

    // If user is authenticated, navigate to home
    useEffect(() => {
        if (user) {
            router.push('/home').catch(() => {
                router.replace('/home').catch(() => {
                    window.location.href = '/home';
                });
            });
        }
    }, [user, router]);

    if (isLoading) {
        return (
            <div className='flex h-screen items-center justify-center'>
                <div className='text-center'>
                    <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4'></div>
                    <p className='text-lg text-gray-600'>Authenticating...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='flex h-screen items-center justify-center'>
                <div className='text-center'>
                    <div className='text-red-600 mb-4'>{error}</div>
                    <button
                        onClick={() => (window.location.href = '/')}
                        className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
