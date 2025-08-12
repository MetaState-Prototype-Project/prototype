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

    function watchEventStream(id: string): void {
        const sseUrl = new URL(
            `/api/auth/sessions/${id}`,
            process.env.NEXT_PUBLIC_BASE_URL
        ).toString();
        const eventSource = new EventSource(sseUrl);

        eventSource.onopen = (): void => {
            console.log('Successfully connected.');
        };

        eventSource.onmessage = async (e): Promise<void> => {
            const data = JSON.parse(e.data as string) as { token: string };
            const { token } = data;
            console.log(token);
            await signInWithCustomToken(token);
        };
    }
    const getOfferData = async (): Promise<void> => {
        const { data } = await axios.get<{ uri: string }>(
            new URL(
                '/api/auth/offer',
                process.env.NEXT_PUBLIC_BASE_URL
            ).toString()
        );
        console.log('getting offer data');
        setQr(data.uri);
        watchEventStream(
            new URL(data.uri).searchParams.get('session') as string
        );
    };

    useEffect(() => {
        getOfferData()
            .then((): void => {
                console.log('QR code data fetched successfully.');
            })
            .catch((error): void => {
                console.error('Error fetching QR code data:', error);
            });
    }, []);

    return (
        <main className='grid lg:grid-cols-[1fr,45vw]'>
            <div className='relative hidden items-center justify-center  lg:flex'>
                <NextImage
                    imgClassName='object-cover'
                    blurClassName='bg-accent-blue'
                    src='/assets/twitter-banner.png'
                    alt='Blabsy banner'
                    layout='fill'
                    useSkeleton
                />
            </div>
            <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-start lg:justify-center min-h-screen'>
                <div className='flex max-w-xs flex-col gap-4 font-twitter-chirp-extended lg:max-w-none lg:gap-16'>
                    <h1 className='text-3xl before:content-["See_what’s_happening_in_the_world_right_now."] lg:text-6xl lg:before:content-["Happening_now"]'>
                        <span className='sr-only'>
                            See what’s happening in the world right now.
                        </span>
                    </h1>
                    <h2 className='hidden text-xl lg:block lg:text-3xl'>
                        Join Blabsy today.
                    </h2>
                    <div>
                        {isMobileDevice() ? (
                            <div className='flex flex-col gap-4 items-center'>
                                <a
                                    href={qr ? getDeepLinkUrl(qr) : '#'}
                                    className='px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center'
                                >
                                    Login with eID Wallet
                                </a>
                                <div className='text-xs text-gray-500 text-center max-w-xs'>
                                    Click the button to open your eID wallet app
                                </div>
                            </div>
                        ) : (
                            <div className='p-2 rounded-md bg-white w-fit'>
                                {qr && <QRCode value={qr} />}
                            </div>
                        )}
                    </div>
                    <div className='absolute right-0 rotate-90 top-1/2'>
                        <Image
                            src='/assets/w3dslogo.svg'
                            alt='W3DS logo'
                            width={100}
                            height={20}
                        />
                    </div>
                </div>
                <div className='flex max-w-lg flex-col gap-6 [&_button]:py-2 bg-white/20 p-4 rounded-lg'>
                    <div className='grid gap-3 font-bold text-white/80'>
                        You are entering Blabsy - a social network built on the
                        Web 3.0 Data Space (W3DS) architecture. This system is
                        designed around the principle of data-platform
                        separation, where all your personal content is stored in
                        your own sovereign eVault, not on centralised servers.
                    </div>
                </div>
            </div>
        </main>
    );
}
