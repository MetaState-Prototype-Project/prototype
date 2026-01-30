import { useEffect, type ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { useHistory } from "@docusaurus/router"

export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();
    const history = useHistory();


    useEffect(() => {
        const baseUrl = siteConfig.baseUrl ?? '/';
        history.push(`${baseUrl}docs/Getting%20Started/getting-started`);
    }, [siteConfig.baseUrl]);

    return (
        <Layout
            title="W3DS Documentation"
            description="Documentation for Web 3 Data Spaces — eVault, Registry, Ontology, and the W3DS protocol.">
        </Layout>
    );
}
