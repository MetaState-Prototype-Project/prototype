import { AuthLayout } from '@components/layout/auth-layout';
import { SEO } from '@components/common/seo';
import { LoginMain } from '@components/login/login-main';
import { LoginFooter } from '@components/login/login-footer';
import type { ReactElement, ReactNode } from 'react';

export default function Login(): JSX.Element {
    return (
        <div className='grid min-h-screen grid-rows-[1fr,auto]'>
            <SEO
                title='Blabsy - It’s what’s happening'
                description='From breaking news and entertainment to sports and politics, get the full story with all the live commentary.'
            />
            <LoginMain />
        </div>
    );
}

Login.getLayout = (page: ReactElement): ReactNode => (
    <AuthLayout>{page}</AuthLayout>
);
