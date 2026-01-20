import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/prototype/__docusaurus/debug',
    component: ComponentCreator('/prototype/__docusaurus/debug', 'b97'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/config',
    component: ComponentCreator('/prototype/__docusaurus/debug/config', 'a4e'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/content',
    component: ComponentCreator('/prototype/__docusaurus/debug/content', '917'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/globalData',
    component: ComponentCreator('/prototype/__docusaurus/debug/globalData', '387'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/metadata',
    component: ComponentCreator('/prototype/__docusaurus/debug/metadata', 'e26'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/registry',
    component: ComponentCreator('/prototype/__docusaurus/debug/registry', 'a9f'),
    exact: true
  },
  {
    path: '/prototype/__docusaurus/debug/routes',
    component: ComponentCreator('/prototype/__docusaurus/debug/routes', 'c78'),
    exact: true
  },
  {
    path: '/prototype/markdown-page',
    component: ComponentCreator('/prototype/markdown-page', 'd93'),
    exact: true
  },
  {
    path: '/prototype/docs',
    component: ComponentCreator('/prototype/docs', '605'),
    routes: [
      {
        path: '/prototype/docs',
        component: ComponentCreator('/prototype/docs', 'dbc'),
        routes: [
          {
            path: '/prototype/docs',
            component: ComponentCreator('/prototype/docs', '053'),
            routes: [
              {
                path: '/prototype/docs/category/getting-started',
                component: ComponentCreator('/prototype/docs/category/getting-started', '81d'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/category/post-platforms-guide',
                component: ComponentCreator('/prototype/docs/category/post-platforms-guide', 'db5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/category/w3ds-basics',
                component: ComponentCreator('/prototype/docs/category/w3ds-basics', '085'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/category/w3ds-protocol',
                component: ComponentCreator('/prototype/docs/category/w3ds-protocol', 'a0b'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/Getting Started/getting-started',
                component: ComponentCreator('/prototype/docs/Getting Started/getting-started', '5c8'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/Post Platform Guide/getting-started',
                component: ComponentCreator('/prototype/docs/Post Platform Guide/getting-started', '32b'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/Post Platform Guide/mapping-rules',
                component: ComponentCreator('/prototype/docs/Post Platform Guide/mapping-rules', '56b'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/Post Platform Guide/webhook-controller',
                component: ComponentCreator('/prototype/docs/Post Platform Guide/webhook-controller', '330'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/W3DS Basics/getting-started',
                component: ComponentCreator('/prototype/docs/W3DS Basics/getting-started', 'c05'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/prototype/docs/W3DS Protocol/getting-started',
                component: ComponentCreator('/prototype/docs/W3DS Protocol/getting-started', 'd7d'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/prototype/',
    component: ComponentCreator('/prototype/', 'c71'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
