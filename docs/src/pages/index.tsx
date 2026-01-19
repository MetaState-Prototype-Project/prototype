import { useEffect, type ReactNode } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { useHistory } from "@docusaurus/router"



export default function Home(): ReactNode {
    const { siteConfig } = useDocusaurusContext();
    const history = useHistory();


    useEffect(() => {
        history.push("/prototype/docs/Getting Started/getting-started")
    }, [])

    useHistory
    return (
        <Layout
            title={`Hello from ${siteConfig.title}`}
            description="Description will go into a meta tag in <head />">
        </Layout>
    );
}
