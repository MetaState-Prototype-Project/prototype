/**
 * The shape of a Forgejo `push` event webhook body, restricted to the fields
 * this service reads. Field names confirmed against GitW3's own source
 * (`modules/structs/hook.go`, `modules/structs/user.go`), not by analogy to
 * Gitea/GitHub docs - traps found doing that:
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
 * 3. `repository.owner` is also a full `User` (`modules/structs/repo.go`'s
 *    `Repository.Owner *User`, `json:"owner"`), and its username field is
 *    JSON-tagged `login` - the same tag as `pusher.login`, confirmed rather
 *    than assumed just because both are `*User`. Used for the repo-owner
 *    snapshot sync - see identity.ts's `IdentityResolver`, reused as-is for
 *    an owner's username the same way it's used for a pusher's.
 * 4. The push's own `after` (`modules/structs/hook.go`'s `PushPayload.After`,
 *    `json:"after"`) is the sha the ref points at once this push lands - the
 *    once-per-push repo snapshot uses this, not any individual commit's own
 *    id, since a multi-commit push has several of those and only the final
 *    one is "the repo's current state" to archive.
 */
export interface ForgejoPushPayload {
    ref: string;
    /** The sha this push's ref now points at - the repo-snapshot archive's own ref parameter. */
    after: string;
    compare_url: string;
    commits: ForgejoPushCommit[];
    repository: {
        /** "owner/name", already combined - no need to build it from parts. */
        full_name: string;
        private: boolean;
        owner: {
            /** The repo's owning account. JSON key is "login", same tag as pusher.login - see note 3 above. */
            login: string;
        };
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
