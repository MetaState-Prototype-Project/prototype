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

**Plural messages.** They compile to a form selector, which a flat replacement
string cannot express. Everything else is correctable.

## Why there is no protected list

Wording on the PIN, recovery and signing screens can talk someone into
revealing a secret or approving something the confirmation misdescribes, so an
earlier version refused corrections for those keys.

It was dropped because publishing goes through a pull request: changing what
users read requires the same merge as changing the code, so the list guarded
nothing the repo did not already guard, while locking the screens where a
clumsy translation is most expensive behind an app release.

**Reinstate it if that ever stops being true** — a bucket upload, a CMS, or an
outside translator with an account. It is the mandatory review that makes the
list unnecessary, not the fact that only developers have access.

## What the app refuses

Bad entries are dropped individually and the rest still applied. A file is
discarded whole only when its `version` is not one the build understands.

| Refused | Why |
| --- | --- |
| Unknown key or locale | Nothing in the build renders it |
| Plural message | See above |
| Placeholder mismatch | `{platform}` must survive the correction, or the message renders a gap |

Rejections are logged with the offending key and reason.

## Behaviour

The catalog is fetched once per launch, after mount, and never blocks
rendering. The request revalidates, so an unchanged catalog costs a 304 rather
than a download. The last good copy is cached in `localStorage`, so
corrections are already on screen at first paint and the app keeps working
offline.
