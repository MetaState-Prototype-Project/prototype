# Runtime translation corrections

Wording fixes reach users without an app store release. `messages/*.json`
remains the source of truth: the file served at `PUBLIC_TRANSLATIONS_URL` is
generated from it and layered over the strings compiled into the build, which
stay the fallback.

## Fixing wording

1. Edit `messages/ru.json` (or `en.json` / `uk.json`).
2. `pnpm translations:build` — regenerates `docs/static/translations.json`.
3. Open a PR and merge it. The docs site redeploys and the correction is live
   in a couple of minutes, with no app release.

`pnpm check` fails when the generated file is stale, so the published catalog
cannot drift from the message files. Leaving `PUBLIC_TRANSLATIONS_URL` empty
disables the fetch entirely, which is the default.

## What this cannot fix

**New strings.** A correction only replaces a key that already shipped, so a
new screen still needs a release to introduce its keys. It does not need its
translations ready first: a key missing from `ru.json` falls back to English
rather than failing the build, and once the release is out its wording is
correctable like everything else.

**Security-critical screens.** Keys under `passphrase_`, `pin_`, `reveal_` and
`signing_` are excluded from the generated file and refused on arrival.
Wording there can talk someone into revealing a secret, or into approving
something the confirmation misdescribes, and that should not be reachable from
a file on a server.

**Plural messages.** They compile to a form selector, which a flat replacement
string cannot express.

Between them those two groups are 71 of 544 keys; the other 473 are
correctable.

## What the app refuses

Bad entries are dropped individually and the rest still applied. A file is
discarded whole only when its `version` is not one the build understands.

| Refused | Why |
| --- | --- |
| Unknown key or locale | Nothing in the build renders it |
| Protected prefix | See above |
| Plural message | See above |
| Placeholder mismatch | `{platform}` must survive the correction, or the message renders a gap |

Rejections are logged with the offending key and reason.

## Behaviour

The catalog is fetched once per launch, after mount, and never blocks
rendering. The request revalidates, so an unchanged catalog costs a 304 rather
than a download. The last good copy is cached in `localStorage`, so
corrections are already on screen at first paint and the app keeps working
offline.
