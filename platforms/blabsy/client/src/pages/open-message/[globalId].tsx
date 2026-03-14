import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function OpenMessagePage(): JSX.Element {
    const router = useRouter();
    const { globalId } = router.query;
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const id = Array.isArray(globalId) ? globalId[0] : globalId;
        if (!id || typeof id !== 'string') {
            setLoading(false);
            setError('Could not find this conversation.');
            return;
        }

        const resolve = async (): Promise<void> => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
                if (!baseUrl) {
                    setError('Application configuration error.');
                    setLoading(false);
                    return;
                }
                const response = await fetch(
                    `${baseUrl}/api/resolve/${encodeURIComponent(id)}`
                );

                if (!response.ok) {
                    setError('Could not find this conversation.');
                    setLoading(false);
                    return;
                }

                const data = await response.json();
                if (data.localId) {
                    await router.replace(
                        `/chat?chatId=${encodeURIComponent(
                            String(data.localId)
                        )}`
                    );
                } else {
                    setError('Could not find this conversation.');
                    setLoading(false);
                }
            } catch (e) {
                console.error('Error resolving message:', e);
                setError('Something went wrong. Please try again.');
                setLoading(false);
            }
        };

        void resolve();
    }, [globalId, router]);

    return (
        <div className='flex flex-col items-center justify-center min-h-screen p-6'>
            {loading ? (
                <p className='text-gray-500'>Opening conversation...</p>
            ) : (
                <>
                    <p className='text-red-500'>{error}</p>
                    <a href='/home' className='mt-4 text-blue-500 underline'>
                        Go to Home
                    </a>
                </>
            )}
        </div>
    );
}
