import { useEffect, useState } from 'react';
import axios from 'axios';

interface Motd {
    status: 'up' | 'maintenance';
    message: string;
}

export function MaintenanceBanner(): JSX.Element | null {
    const [motd, setMotd] = useState<Motd | null>(null);

    useEffect(() => {
        const fetchMotd = async () => {
            try {
                const registryUrl = process.env.NEXT_PUBLIC_REGISTRY_URL || 'http://localhost:4321';
                const response = await axios.get<Motd>(`${registryUrl}/motd`);
                setMotd(response.data);
            } catch (error) {
                console.error('Failed to fetch motd:', error);
            }
        };

        void fetchMotd();
    }, []);

    if (motd?.status !== 'maintenance') {
        return null;
    }

    return (
        <div className='bg-yellow-500 px-4 py-3 text-center text-sm font-medium text-black'>
            ⚠️ {motd.message}
        </div>
    );
}

