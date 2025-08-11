import Head from 'next/head';

export function AppHead(): JSX.Element {
    return (
        <Head>
            <title>Blabsy</title>
            <meta name='og:title' content='Blabsy' />
            <link rel='icon' href='/logo.png' type='image/png' />
            <link rel='icon' href='/logo.svg' type='image/svg+xml' />
            <link rel='manifest' href='/site.webmanifest' key='site-manifest' />
            <meta name='twitter:site' content='@ccrsxx' />
            <meta name='twitter:card' content='summary_large_image' />
        </Head>
    );
}
