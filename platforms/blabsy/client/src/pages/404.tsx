import Error from 'next/error';
import { SEO } from '@components/common/seo';

export default function NotFound(): JSX.Element {
    // Always use dark mode
    const isDarkMode = true;

    return (
        <>
            <SEO
                title='Page not found / Blabsy'
                description='Sorry we could not find the page you were looking for.'
                image='/404.png'
            />
            <Error statusCode={404} withDarkMode={isDarkMode} />
        </>
    );
}
