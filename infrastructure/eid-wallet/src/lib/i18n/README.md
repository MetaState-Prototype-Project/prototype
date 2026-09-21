# Runtime translation corrections

Wording fixes reach users without an app store release. The strings compiled
into the build remain the source of truth and the fallback; a correction only
ever replaces a string that already shipped.

## Publishing a correction

Serve a single JSON file at `PUBLIC_TRANSLATIONS_URL`:

```json
{
  "version": 1,
  "messages": {
    "ru": { "common_accept": "Принять" },
    "uk": { "common_accept": "Прийняти" }
  }
}
```

Keys are the message names in `messages/en.json`. Only the keys you list are
replaced — omit everything else. Serving `{"version": 1, "messages": {}}`
rolls every correction back to the shipped strings.

Leaving `PUBLIC_TRANSLATIONS_URL` empty disables the fetch entirely.

## What the app refuses

Corrections are validated on arrival and bad entries are dropped individually,
with the rest still applied. A file is discarded whole only if its `version`
is not one this build understands.

| Refused | Why |
| --- | --- |
| Unknown key or locale | Nothing in the build renders it |
| `passphrase_*`, `pin_*`, `reveal_*`, `signing_*` | Wording on these screens can talk someone into revealing a secret, or into approving something the confirmation misdescribes, so it stays in the signed binary |
| Plural messages | They compile to a form selector, which a flat string cannot express |
| Placeholder mismatch | `{platform}` must survive the correction, or the message renders a gap |

Rejections are logged to the console with the offending key and reason.

## Behaviour

The catalog is fetched once per launch, after mount, and never blocks
rendering. The last good copy is cached in `localStorage`, so corrections are
already on screen at first paint and the app keeps working offline.
