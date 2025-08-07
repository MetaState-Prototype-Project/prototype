<!-- # Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
pnpm dev
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
- [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference) -->

# MetaState Prototype

## Progress Tracker

| Project                                    | Status      |
| ------------------------------------------ | ----------- |
| [W3ID](./infrastructure/w3id/)             | In Progress |
| [eID Wallet](./infrastructure/eid-wallet/) | In Progress |
| EVault Core                                | Planned     |
| Web3 Adapter                               | Planned     |

## Documentation Links

| Documentation                | Description                                 | Link                                                                       |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| MetaState Prototype          | Main project README                         | [README.md](./README.md)                                                   |
| W3ID                         | Web 3 Identity System documentation         | [W3ID README](./infrastructure/w3id/README.md)                             |
| eVault Core                  | Core eVault system documentation            | [eVault Core README](./infrastructure/evault-core/README.md)               |
| eVault Core W3ID Integration | W3ID integration details for eVault Core    | [W3ID Integration](./infrastructure/evault-core/docs/w3id-integration.md)  |
| eVault Provisioner           | Provisioning eVault instances documentation | [eVault Provisioner README](./infrastructure/evault-provisioner/README.md) |
| Bug Report Template          | GitHub issue template for bug reports       | [Bug Report Template](./.github/ISSUE_TEMPLATE/bug-report.md)              |

## Project Structure

```
prototype/
├─ .vscode/
│  └─ settings.json
├─ infrastructure/
│  ├─ evault-core/
│  │  └─ package.json
│  └─ w3id/
│     └─ package.json
├─ packages/
│  ├─ eslint-config/
│  │  ├─ base.js
│  │  ├─ next.js
│  │  ├─ package.json
│  │  ├─ react-internal.js
│  │  └─ README.md
│  └─ typescript-config/
│     ├─ base.json
│     ├─ nextjs.json
│     ├─ package.json
│     └─ react-library.json
├─ platforms/
│  └─ .gitkeep
├─ services/
│  ├─ ontology/ (MetaState Ontology Service)
│  │  └─ package.json
│  └─ web3-adapter/ (MetaState Web-3 Adapter Service)
│     └─ package.json
├─ .gitignore (Ignores files while upstream to repo)
├─ .npmrc (Dependency Manager Conf)
├─ package.json (Dependency Management)
├─ pnpm-lock.yaml (Reproducability)
├─ pnpm-workspace.yaml (Configures MonoRepo)
├─ README.md (This File)
└─ turbo.json (Configures TurboRepo)
```
