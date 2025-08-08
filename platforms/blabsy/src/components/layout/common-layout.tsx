import { useRequireAuth } from '@lib/hooks/useRequireAuth';
import { Aside } from '@components/aside/aside';
import { Suggestions } from '@components/aside/suggestions';
import { Placeholder } from '@components/common/placeholder';
import { type ReactNode, useState } from 'react';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';
import { useAuth } from '@lib/context/auth-context';

export type LayoutProps = {
    children: ReactNode;
};

export function ProtectedLayout({ children }: LayoutProps): JSX.Element {
    const user = useRequireAuth();
    const { signOut } = useAuth();

    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
    if (!user) return <Placeholder />;

    return (
        <>
            {children}
            {!disclaimerAccepted ? (
                <Modal
                    open={!disclaimerAccepted}
                    closeModal={() => signOut()}
                    className='max-w-lg mx-auto mt-24'
                    modalClassName='bg-black backdrop-blur-md p-6 rounded-lg flex flex-col gap-2'
                >
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
                        className='outline-none'
                    >
                        info@metastate.foundation
                    </a>
                    <Button
                        type='button'
                        className='mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
                        onClick={() => {
                            setDisclaimerAccepted(true);
                        }}
                    >
                        I Understand
                    </Button>
                </Modal>
            ) : (
                <></>
            )}
        </>
    );
}

export function HomeLayout({ children }: LayoutProps): JSX.Element {
    return (
        <>
            {children}
            <Aside>
                {/* <AsideTrends /> */}
                <Suggestions />
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
