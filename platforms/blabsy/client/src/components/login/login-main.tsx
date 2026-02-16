import QRCode from 'react-qr-code';
import axios from 'axios';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@lib/context/auth-context';
import { NextImage } from '@components/ui/next-image';
import Image from 'next/image';
import { isMobileDevice, getDeepLinkUrl } from '@lib/utils/mobile-detection';

export function LoginMain(): JSX.Element {
    const { signInWithCustomToken } = useAuth();
    const [qr, setQr] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

    const watchEventStream = useCallback((id: string): EventSource => {
        const sseUrl = new URL(
            `/api/auth/sessions/${id}`,
            process.env.NEXT_PUBLIC_BASE_URL
        ).toString();
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = (): void => {
            console.log('Successfully connected.');
            setErrorMessage(null);
        };

        eventSource.onmessage = async (e): Promise<void> => {
            const data = JSON.parse(e.data as string) as {
                token?: string;
                error?: boolean;
                message?: string;
                type?: string;
            };

            if (data.error && data.type === 'version_mismatch') {
                setErrorMessage(
                    data.message ||
                        'Your eID Wallet app version is outdated. Please update to continue.'
                );
                eventSource.close();
                return;
            }

            if (data.token) {
                await signInWithCustomToken(data.token);
            }
        };

        eventSource.onerror = (): void => {
            console.error('SSE connection error');
            eventSource.close();
        };

        return eventSource;
    }, [signInWithCustomToken]);

    const getOfferData = useCallback(async (): Promise<void> => {
        // Clean up existing SSE connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        // Clean up existing refresh timer
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        const { data } = await axios.get<{ uri: string }>(
            new URL(
                '/api/auth/offer',
                process.env.NEXT_PUBLIC_BASE_URL
            ).toString()
        );
        setQr(data.uri);
        eventSourceRef.current = watchEventStream(
            new URL(data.uri).searchParams.get('session') as string
        );

        // Set up auto-refresh after 60 seconds
        refreshTimerRef.current = setTimeout(() => {
            console.log('Refreshing QR code after 60 seconds');
            getOfferData().catch((error) =>
                console.error('Error refreshing QR code:', error)
            );
        }, 60000);
    }, [watchEventStream]);

    const getAppStoreLink = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
        }

        const userAgent =
            navigator.userAgent || navigator.vendor || (window as any).opera;

        if (/android/i.test(userAgent)) {
            return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
        }

        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            return 'https://apps.apple.com/in/app/eid-for-w3ds/id6747748667';
        }

        return 'https://play.google.com/store/apps/details?id=foundation.metastate.eid_wallet';
    };

    // Check for query parameters and auto-login
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
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

        // If no query params, proceed with normal flow
        getOfferData().catch((error) =>
            console.error('Error fetching QR code data:', error)
        );

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, [getOfferData]);

    const handleAutoLogin = async (
        ename: string,
        session: string,
        signature: string,
        appVersion: string
    ) => {
        try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
            if (!baseUrl) {
                console.error('NEXT_PUBLIC_BASE_URL not configured');
                return;
            }

            const response = await fetch(`${baseUrl}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ename, session, signature, appVersion })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    await signInWithCustomToken(data.token);
                }
            } else {
                const errorData = await response.json();
                console.error('Login failed:', errorData);
                if (errorData.error && errorData.type === 'version_mismatch') {
                    setErrorMessage(
                        errorData.message ||
                            'Your eID Wallet app version is outdated. Please update to continue.'
                    );
                }
            }
        } catch (error) {
            console.error('Login request failed:', error);
        }
    };

    return (
        <main className='grid lg:grid-cols-[1fr,45vw]'>
            {/* Left side image */}
            <div className='relative hidden items-center justify-center lg:flex'>
                <NextImage
                    imgClassName='object-cover'
                    blurClassName='bg-accent-blue'
                    src='/assets/twitter-banner.png'
                    alt='Blabsy banner'
                    layout='fill'
                    useSkeleton
                />
            </div>

            {/* Right side content */}
            <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-center lg:justify-center min-h-screen'>
                <div className='flex max-w-xs flex-col gap-4 font-twitter-chirp-extended lg:max-w-none lg:gap-16'>
                    <h1 className='text-center text-3xl before:content-["See_what’s_happening_in_the_world_right_now."] lg:text-6xl lg:before:content-["Happening_now"]'>
                        <span className='sr-only'>
                            See what’s happening in the world right now.
                        </span>
                    </h1>

                    <h2 className='hidden text-center text-xl lg:block lg:text-3xl'>
                        Join Blabsy today.
                    </h2>

                    <div>
                        {errorMessage && (
                            <div className='mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg'>
                                <p className='font-semibold'>
                                    Authentication Error
                                </p>
                                <p className='text-sm'>{errorMessage}</p>
                            </div>
                        )}

                        {isMobileDevice() ? (
                            <div className='flex flex-col gap-4 items-center'>
                                <div className='text-xs text-gray-500 text-center max-w-xs'>
                                    Click the button to open your{' '}
                                    <a href={getAppStoreLink()}>
                                        <b>
                                            <u>eID App</u>
                                        </b>
                                    </a>{' '}
                                    to login
                                </div>

                                <a
                                    href={qr ? getDeepLinkUrl(qr) : '#'}
                                    className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center'
                                >
                                    Login with eID Wallet
                                </a>

                                <div className='text-center mt-4'>
                                    <p className='text-sm text-gray-500'>
                                        <span className='mb-1 block font-bold text-gray-600'>
                                            The button is valid for 60 seconds
                                        </span>
                                        <span className='block font-light text-gray-600'>
                                            It will refresh automatically
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className='flex flex-col gap-4 items-center'>
                                <p className='text-gray-600'>
                                    Scan the QR code using your{' '}
                                    <a href={getAppStoreLink()}>
                                        <b>
                                            <u>eID App</u>
                                        </b>
                                    </a>{' '}
                                    to login
                                </p>

                                <div className='p-2 rounded-md bg-white w-fit'>
                                    {qr && <QRCode value={qr} />}
                                </div>

                                <div className='text-center mt-4'>
                                    <p className='text-sm text-gray-500'>
                                        <span className='mb-1 block font-bold text-gray-600'>
                                            The code is valid for 60 seconds
                                        </span>
                                        <span className='block font-light text-gray-600'>
                                            It will refresh automatically
                                        </span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Info Box */}
                <div className='flex max-w-lg flex-col gap-6 [&_button]:py-2 bg-white/20 p-4 rounded-lg'>
                    <div className='grid gap-3 text-center font-bold text-white/70'>
                        You are entering Blabsy - a social network built on the
                        Web 3.0 Data Space (W3DS) architecture. This system is
                        designed around data-platform separation, where all your
                        personal content is stored in your own sovereign eVault,
                        not on centralized servers.
                    </div>

                    <a
                        href='https://metastate.foundation'
                        target='_blank'
                        rel='noopener noreferrer'
                    >
                        <Image
                            src='/assets/w3dslogo.svg'
                            alt='W3DS logo'
                            width={100}
                            height={20}
                        />
                    </a>
                </div>
            </div>
        </main>
    );
}
