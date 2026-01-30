import { useEffect, type ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { useHistory, useLocation } from '@docusaurus/router';

export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();
    const history = useHistory();
    const location = useLocation();

    useEffect(() => {
        const raw = siteConfig.baseUrl ?? '/';
        const baseUrl = raw.endsWith('/') ? raw : `${raw}/`;
        const rootPathname = baseUrl === '/' ? '/' : baseUrl.replace(/\/$/, '');
        if (location.pathname !== rootPathname && location.pathname !== baseUrl) return;
        history.replace(`${baseUrl}docs/Getting%20Started/getting-started`);
    }, [siteConfig.baseUrl, location.pathname, history]);

    return (
        <Layout
            title="W3DS Documentation"
            description="Documentation for Web 3 Data Spaces — eVault, Registry, Ontology, and the W3DS protocol.">
        </Layout>
    );
}
