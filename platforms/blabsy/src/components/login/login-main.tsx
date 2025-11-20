import QRCode from 'react-qr-code';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '@lib/context/auth-context';
import { NextImage } from '@components/ui/next-image';
import Image from 'next/image';
import { isMobileDevice, getDeepLinkUrl } from '@lib/utils/mobile-detection';

export function LoginMain(): JSX.Element {
    const { signInWithCustomToken } = useAuth();
    const [qr, setQr] = useState<string>();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    function watchEventStream(id: string): void {
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
    }

    const getOfferData = async (): Promise<void> => {
        const { data } = await axios.get<{ uri: string }>(
            new URL(
                '/api/auth/offer',
                process.env.NEXT_PUBLIC_BASE_URL
            ).toString()
        );
        setQr(data.uri);
        watchEventStream(
            new URL(data.uri).searchParams.get('session') as string
        );
    };

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

    useEffect(() => {
        getOfferData().catch((error) =>
            console.error('Error fetching QR code data:', error)
        );
    }, []);

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
                                            Please refresh the page if it
                                            expires
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
                                            Please refresh the page if it
                                            expires
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
