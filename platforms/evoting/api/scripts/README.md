# Evoting Seeding Scripts

## Quick Start

Seed the database with test users, groups, and charters:

```bash
pnpm seed
```

Or add your own user to all groups:

```bash
pnpm seed @your-ename-here
```

## What Gets Created

**5 Test Users:**

- alice (verified, admin of Tech Community)
- bob (verified, admin of Local Council)
- charlie (regular member)
- diana (verified, admin of Private Board)
- eve (regular member)

**3 Groups with Charters:**

- Tech Community (public, all users)
- Local Council (public, 3 members)
- Private Board (private, 2 members)

## Utility Scripts

Check a user's group memberships:

```bash
npx ts-node scripts/check-user-groups.ts @your-ename
```
