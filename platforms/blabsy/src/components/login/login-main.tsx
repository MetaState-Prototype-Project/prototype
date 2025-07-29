import QRCode from 'react-qr-code';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useAuth } from '@lib/context/auth-context';
import { NextImage } from '@components/ui/next-image';

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
            <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-start lg:justify-center'>
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
                        <div className='p-2 rounded-md bg-white w-fit'>
                            {qr && <QRCode value={qr} />}
                        </div>
                    </div>
                </div>
                <div className='flex max-w-xs flex-col gap-6 [&_button]:py-2'>
                    <div className='grid gap-3 font-bold' />
                </div>
            </div>
        </main>
    );
}
