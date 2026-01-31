import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
    title: 'W3DS Documentation',
    tagline: 'Documentation for Web 3 Data Spaces',
    favicon: 'img/w3dslogo.svg',

    // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
    future: {
        v4: true, // Improve compatibility with the upcoming Docusaurus v4
    },

    markdown: {
        mermaid: true,
    },

    themes: ['@docusaurus/theme-mermaid'],

    // Production URL: hosted at docs.w3ds.metastate.foundation
    url: 'https://docs.w3ds.metastate.foundation',
    baseUrl: '/',

    organizationName: 'MetaState-Prototype-Project',
    projectName: 'metastate',
    trailingSlash: false,

    onBrokenLinks: 'throw',

    // Even if you don't use internationalization, you can use this field to set
    // useful metadata like html lang. For example, if your site is Chinese, you
    // may want to replace "en" with "zh-Hans".
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    sidebarPath: './sidebars.ts',
                    editUrl: 'https://github.com/MetaState-Prototype-Project/prototype/tree/main/docs/',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        image: 'img/w3dslogo.svg',
        colorMode: {
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: "",
            logo: {
                src: "/img/w3dslogo.svg"
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'tutorialSidebar',
                    position: 'left',
                    label: 'Docs',
                },
                {
                    href: 'https://github.com/MetaState-Prototype-Project/prototype',
                    label: 'GitHub',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        {
                            label: 'Getting Started',
                            to: '/docs/Getting%20Started/getting-started',
                        },
                        {
                            label: 'W3DS Basics',
                            to: '/docs/W3DS%20Basics/getting-started',
                        },
                        {
                            label: 'Infrastructure',
                            to: '/docs/Infrastructure/eVault',
                        },
                        {
                            label: 'Links',
                            to: '/docs/W3DS%20Basics/Links',
                        },
                    ],
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Stichting MetaState Foundation.`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
