#!/bin/sh
# Register — or update — the W3DS authentication source in GitW3.
#
# Forgejo keeps authentication sources in its database, not in app.ini, so they cannot be
# declared alongside the rest of the configuration. Without this, a fresh instance needs
# someone to click through Site Administration before anyone can log in, which makes the
# deployment only mostly reproducible. The script is idempotent, so it can run on every
# deploy: it updates the source when it already exists and creates it otherwise.
#
# Runs as the one-shot `gitw3-auth-source` service in docker-compose.gitw3.yml, sharing
# GitW3's data volume. `gitea` is the shim in /usr/local/bin, which points the CLI at
# /data/gitea — the same configuration the running instance reads.
set -eu

: "${W3DS_OIDC_PUBLIC_URL:?}"
: "${W3DS_OIDC_CLIENT_ID:?}"
: "${W3DS_OIDC_CLIENT_SECRET:?}"

NAME="${GITW3_AUTH_SOURCE_NAME:-W3DS}"

# The source name is also a URL segment — Forgejo serves /user/oauth2/<name>/callback — and
# the bridge compares the redirect URI byte for byte. A name with a space in it produces a
# callback the bridge will always reject, so refuse it here rather than at the first login.
case "$NAME" in
    *[!A-Za-z0-9_-]*)
        echo "GITW3_AUTH_SOURCE_NAME must be URL-safe — got '$NAME'" >&2
        exit 1
        ;;
esac

# `admin auth list` prints a tab-separated table: ID, Name, Type, Enabled.
id=$(gitea admin auth list | awk -F'\t' -v want="$NAME" '$2 == want { print $1 }')

# Scopes are set explicitly. The CLI leaves them empty when the flag is absent, whereas the
# admin UI pre-fills these three — so an omission here would produce a source subtly unlike
# every one created by hand.
set -- \
    --provider openidConnect \
    --key "$W3DS_OIDC_CLIENT_ID" \
    --secret "$W3DS_OIDC_CLIENT_SECRET" \
    --auto-discover-url "${W3DS_OIDC_PUBLIC_URL}/.well-known/openid-configuration" \
    --icon-url "${W3DS_OIDC_PUBLIC_URL}/icon.svg" \
    --scopes openid --scopes profile --scopes email

if [ -n "$id" ]; then
    echo "updating authentication source '$NAME' (id $id)"
    gitea admin auth update-oauth --id "$id" --name "$NAME" "$@"
else
    echo "creating authentication source '$NAME'"
    gitea admin auth add-oauth --name "$NAME" "$@"
fi

# Forgejo resolves the discovery document once, when it registers its sources at startup, so
# a source added after boot is inert until the next restart. Say so rather than leaving the
# operator to discover it through a login button that isn't there.
echo
echo "GitW3 must be restarted for this to take effect:"
echo "    docker compose -f docker-compose.gitw3.yml restart gitw3"
