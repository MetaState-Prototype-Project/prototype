/**
 * The shape of a Forgejo `push` event webhook body, restricted to the fields
 * this service reads. Field names confirmed against GitW3's own source
 * (`modules/structs/hook.go`, `modules/structs/user.go`), not by analogy to
 * Gitea/GitHub docs - two traps found doing that:
 *
 * 1. `pusher` is a full `User`, whose username field is JSON-tagged `login`, not
 *    `username`. GitW3's `services/webhook/notifier.go` builds it via
 *    `convert.ToUser(ctx, pusher, nil)` with a nil `doer`, so `login_name` is
 *    never populated here regardless of how the pusher authenticated - resolving
 *    an eName from this payload alone is not possible, see identity.ts.
 * 2. Each commit's `author`/`committer` is a *different* struct (`PayloadUser`),
 *    whose username field IS JSON-tagged `username`. Free-text git config, never
 *    validated against any Forgejo account - this service must never resolve
 *    identity from it. See docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md
 *    ("pusher and each commit's author are different things").
 */
export interface ForgejoPushPayload {
    ref: string;
    compare_url: string;
    commits: ForgejoPushCommit[];
    repository: {
        /** "owner/name", already combined - no need to build it from parts. */
        full_name: string;
        private: boolean;
    };
    pusher: {
        /** The authenticated Forgejo account that ran `git push`. JSON key is "login", not "username". */
        login: string;
    };
}

export interface ForgejoPushCommit {
    id: string;
    message: string;
    url: string;
    timestamp: string;
    added: string[];
    removed: string[];
    modified: string[];
}
