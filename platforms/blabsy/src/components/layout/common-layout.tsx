import { useRequireAuth } from '@lib/hooks/useRequireAuth';
import { Aside } from '@components/aside/aside';
import { Suggestions } from '@components/aside/suggestions';
import { Placeholder } from '@components/common/placeholder';
import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';

export type LayoutProps = {
    children: ReactNode;
};

const DISCLAIMER_KEY = 'blabsy-disclaimer-accepted';

// Safe localStorage access for restricted environments
const safeGetItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeSetItem = (key: string, value: string): void => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Silently fail in restricted environments
    }
};

export function ProtectedLayout({ children }: LayoutProps): JSX.Element {
    const user = useRequireAuth();

    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    const [disclaimerChecked, setDisclaimerChecked] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);

    useEffect(() => {
        let accepted = false;
        try {
            accepted = localStorage.getItem(DISCLAIMER_KEY) === 'true';
        } catch {
            // Storage may be unavailable; fall back to session-only acceptance.
        }
        setDisclaimerAccepted(accepted);
        setDisclaimerChecked(true);
    }, []);

    const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleOutsideClick = () => {
        setIsPulsing(true);
        setShowHint(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 400);
    };
    if (!user) return <Placeholder />;
    if (!disclaimerChecked) return <></>;
    if (disclaimerAccepted) return <>{children}</>;

    return (
        <>
            {children}
            <Modal
                open={true}
                closeModal={handleOutsideClick}
                className='max-w-lg mx-auto mt-24'
                modalClassName={`bg-black backdrop-blur-md p-6 rounded-lg flex flex-col gap-2 ${isPulsing ? 'animate-pulse-scale' : ''}`}
            >
                <style>{`
                    @keyframes pulse-scale {
                        0% { transform: scale(1); }
                        25% { transform: scale(1.01); }
                        50% { transform: scale(0.99); }
                        75% { transform: scale(1.005); }
                        100% { transform: scale(1); }
                    }
                    .animate-pulse-scale {
                        animation: pulse-scale 0.4s ease-in-out;
                    }
                `}</style>
                <h1 className='text-xl text-center font-bold'>
                    Disclaimer from MetaState Foundation
                </h1>
                <p className='font-bold'>⚠️ Please note:</p>
                <p>
                    Blabsy is a <b>functional prototype</b>, intended to
                    showcase <b>interoperability</b> and core concepts of
                    the W3DS ecosystem.
                </p>
                <p>
                    <b>It is not a production-grade platform</b> and may
                    lack full reliability, performance, and security
                    guarantees.
                </p>
                <p>
                    We <b>strongly recommend</b> that you avoid sharing{' '}
                    <b>sensitive or private content</b>, and kindly ask for
                    your understanding regarding any bugs, incomplete
                    features, or unexpected behaviours.
                </p>
                <p>
                    The app is still in development, so we kindly ask for
                    your understanding regarding any potential issues. If
                    you experience issues or have feedback, feel free to
                    contact us at:
                </p>
                <a
                    href='mailto:info@metastate.foundation'
                    className='focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
                >
                    info@metastate.foundation
                </a>
                <div className='relative mt-4'>
                    {showHint && (
                        <div className='mb-2 text-xs text-center text-yellow-400 bg-yellow-900/30 px-3 py-2 rounded'>
                            💡 You must accept the disclaimer to continue. This will only appear once.
                        </div>
                    )}
                    <Button
                        type='button'
                        className='w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'

                        onClick={() => {
                            try {
                                localStorage.setItem(DISCLAIMER_KEY, 'true');
                            } catch {
                                // Ignore storage failures; allow access for this session.
                            }
                            setDisclaimerAccepted(true);
                        }}
                    >
                        I Understand
                    </Button>
                </div>
            </Modal>
        </>
    );
}

export function HomeLayout({ children }: LayoutProps): JSX.Element {
    return (
        <>
            {children}
            <Aside>
                {/* <AsideTrends /> */}
                {/* <Suggestions /> */}
            </Aside>
        </>
    );
}

export function UserLayout({ children }: LayoutProps): JSX.Element {
    return (
        <>
            {children}
            <Aside>
                <Suggestions />
                {/* <AsideTrends /> */}
            </Aside>
        </>
    );
}

export function TrendsLayout({ children }: LayoutProps): JSX.Element {
    return (
        <>
            {children}
            <Aside>
                <Suggestions />
            </Aside>
        </>
    );
}

export function PeopleLayout({ children }: LayoutProps): JSX.Element {
    return (
        <>
            {children}
            <Aside>
                {/* <AsideTrends /> */}
                <div />
            </Aside>
        </>
    );
}
