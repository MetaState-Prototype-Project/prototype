import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildDelegatedSignRequest,
    buildGrantSignRequest,
    verifyDelegatedSignature,
    verifyEnameSignature,
    verifyLoginSignature,
    type VerifyDelegatedSignatureResult,
} from "@metastate-foundation/auth";
import {
    COMPANY_ONTOLOGY,
    DELEGATED_SIGNATURE_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    evaluateFromHistory,
    resolveBoard,
    ROLE_ONTOLOGY,
} from "@metastate-foundation/delegation";
import { provision, syncPublicKeyToEvaultWithOptions } from "wallet-sdk";
import {
    newRecordId,
    platformToken,
    PROVISIONER_URL,
    provisionKeylessEVault,
    readHistory,
    readRecord,
    REGISTRY_URL,
    VERIFICATION_ID,
    writeRecord,
} from "./stack.js";
import {
    NodeWalletAdapter,
    scanSignRequest,
    type StoredKey,
} from "./wallet.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = join(ROOT, ".demo", "state.json");
const config = JSON.parse(
    readFileSync(join(ROOT, "demo.config.json"), "utf8"),
) as Config;

type Config = {
    company: { name: string; legalName: string; jurisdiction: string };
    people: Record<string, { name: string; about: string }>;
    directors: string[];
    roles: Record<
        string,
        { title: string; scopes: string[]; mayRedelegate: boolean }
    >;
    delegations: Record<
        string,
        {
            to: string;
            role?: string;
            parent?: string;
            grantedBy: string;
            title: string;
            scopes: string[];
            mayRedelegate: boolean;
        }
    >;
};

/** Everything the demo generated, kept between runs. */
type State = {
    keys: Record<string, StoredKey>;
    people: Record<string, { eName: string; keyId: string }>;
    company?: {
        eName: string;
        companyId: string;
        roles: Record<string, string>;
        delegations: Record<string, string>;
    };
};

export type LogEntry = {
    at: string;
    who?: string;
    text: string;
    detail?: string;
};

export type Outcome = {
    scenario: string;
    expected: "valid" | "refused";
    passed: boolean;
    summary: string;
    result?: unknown;
    /** Acme as stored and as verified right after this scenario. */
    view?: unknown;
    /** The hops a verifier walked, signer first. */
    trace?: TraceStep[];
};

export type TraceStep = {
    kind: "delegation" | "role" | "board";
    /** The person this hop is about, by config key. */
    person?: string;
    text: string;
    /** true checked, false where it broke, null never reached. */
    ok: boolean | null;
    reason?: string;
};

const now = () => new Date().toISOString();

export class Demo {
    private state: State;
    private adapter: NodeWalletAdapter;
    private pending = new Map<string, (signature: string) => void>();
    readonly log: LogEntry[] = [];
    /** The latest outcome per scenario, so a reloaded page shows them. */
    readonly outcomes: Record<string, Outcome> = {};
    /** Acme as stored and as verified right after setup. */
    private setupView: unknown = null;
    /** The last computed view; recomputed only after something changed. */
    private cachedView: Awaited<ReturnType<Demo["view"]>> | undefined;
    /** Grant signatures never change, so each is checked against the Registry once. */
    private checked = new Map<string, Promise<boolean>>();
    private lastSignature?: { payload: string; signature: string };

    constructor(private callbackUrl: string) {
        this.state = load();
        this.adapter = new NodeWalletAdapter(this.state.keys);
    }

    /** The wallet POSTed a signature to the callback. */
    receiveSignature(body: {
        sessionId?: string;
        signature?: string;
        w3id?: string;
    }) {
        const resolve = body.sessionId
            ? this.pending.get(body.sessionId)
            : undefined;
        if (!resolve || typeof body.signature !== "string") return false;
        this.pending.delete(body.sessionId as string);
        this.note(body.w3id, "wallet POSTed its signature to the callback");
        resolve(body.signature);
        return true;
    }

    reset() {
        this.state.company = undefined;
        save(this.state);
        this.log.length = 0;
        for (const k of Object.keys(this.outcomes)) delete this.outcomes[k];
        this.setupView = null;
    }

    /** Runs a scenario and remembers how it ended. */
    async run(id: string): Promise<Outcome> {
        const scenario = this.scenarios[id];
        if (!scenario) throw new Error(`unknown scenario ${id}`);
        await this.heal(id);
        const outcome = await scenario.run();
        outcome.view = this.cachedView = await this.view();
        this.outcomes[id] = outcome;
        return outcome;
    }

    /**
     * Acme as a verifier sees it: the board and each delegation resolved from
     * the eVault's history, where unsigned or unentitled writes count for nothing.
     */
    private async verifiedView() {
        const company = this.state.company;
        if (!company) return null;
        // Each record's history is read once per view, however many chains use it.
        const histories = new Map<string, ReturnType<typeof readHistory>>();
        const source = {
            versions: (id: string) => {
                if (!histories.has(id))
                    histories.set(id, readHistory(company.eName, id));
                return histories.get(id) as ReturnType<typeof readHistory>;
            },
        };
        const verify = (eName: string, payload: string, signature: string) =>
            this.verifyGrant(eName, payload, signature);
        const board = await resolveBoard(
            company.companyId,
            company.eName,
            source,
            verify,
        );
        const delegations: Record<string, string> = {};
        for (const [key, id] of Object.entries(company.delegations)) {
            const chain = await evaluateFromHistory({
                delegationId: id,
                companyEName: company.eName,
                companyId: company.companyId,
                source,
                verify,
            });
            delegations[key] = chain.ok ? "valid" : chain.code;
        }
        return { board: board.at(-1)?.directors ?? [], delegations };
    }

    // ---- setup ---------------------------------------------------------

    /** Everyone's wallet and eVault; created once and reused. */
    async preparePeople(): Promise<void> {
        for (const key of Object.keys(config.people)) await this.person(key);
    }

    async setup(): Promise<void> {
        await this.preparePeople();
        if (this.state.company) return;

        const company = await provisionKeylessEVault();
        this.note(
            undefined,
            `provisioned Acme's company eVault ${company.eName}`,
        );
        const record = {
            companyId: newRecordId(),
            roles: {} as Record<string, string>,
            delegations: {} as Record<string, string>,
        };

        // Born with its board: the first version already carries directors.
        const director = config.directors[0];
        await this.grant(
            director,
            company.eName,
            COMPANY_ONTOLOGY,
            record.companyId,
            {
                id: "acme",
                eName: company.eName,
                directors: config.directors.map((d) => this.eName(d)),
                displayName: config.company.name,
                legalName: config.company.legalName,
                jurisdiction: config.company.jurisdiction,
                createdAt: now(),
                updatedAt: now(),
            },
            "Set Acme's board",
        );

        for (const [key, role] of Object.entries(config.roles)) {
            record.roles[key] = newRecordId();
            await this.grant(
                director,
                company.eName,
                ROLE_ONTOLOGY,
                record.roles[key],
                {
                    companyEName: company.eName,
                    title: role.title,
                    scopes: role.scopes,
                    mayRedelegate: role.mayRedelegate,
                    status: "active",
                    createdBy: this.eName(director),
                    createdAt: now(),
                    updatedAt: now(),
                },
                `Create role "${role.title}"`,
            );
        }

        for (const [key, d] of Object.entries(config.delegations)) {
            record.delegations[key] = newRecordId();
            await this.grant(
                d.grantedBy,
                company.eName,
                DELEGATION_ONTOLOGY,
                record.delegations[key],
                {
                    companyEName: company.eName,
                    delegateEName: this.eName(d.to),
                    ...(d.role
                        ? { roleId: record.roles[d.role] }
                        : {
                              parentDelegationId:
                                  record.delegations[d.parent as string],
                          }),
                    title: d.title,
                    scopes: d.scopes,
                    mayRedelegate: d.mayRedelegate,
                    grantedBy: this.eName(d.grantedBy),
                    status: "active",
                    createdAt: now(),
                    updatedAt: now(),
                },
                `Delegate "${d.title}" to ${config.people[d.to].name}`,
            );
        }

        this.state.company = { eName: company.eName, ...record };
        save(this.state);
    }

    /** A real wallet with a real eVault, via wallet-sdk. */
    private async person(key: string) {
        if (this.state.people[key]) return;
        const keyId = `demo-${key}`;
        await this.adapter.ensureKey(keyId);
        const result = await provision(this.adapter, {
            registryUrl: REGISTRY_URL,
            provisionerUrl: PROVISIONER_URL,
            namespace: randomUUID(),
            verificationId: VERIFICATION_ID,
            keyId,
        });
        await syncPublicKeyToEvaultWithOptions({
            evaultUrl: result.uri,
            eName: result.w3id,
            cryptoAdapter: this.adapter,
            keyId,
            context: "onboarding",
            token: await platformToken(),
        });
        this.state.people[key] = { eName: result.w3id, keyId };
        save(this.state);
        this.note(
            result.w3id,
            `${config.people[key].name}'s wallet provisioned an eVault and bound its key`,
        );
    }

    /** A director or delegate approves a record through w3ds://sign. */
    private async grant(
        signer: string,
        companyEName: string,
        ontology: string,
        recordId: string,
        record: Record<string, unknown>,
        message: string,
    ) {
        const request = await buildGrantSignRequest({
            ontology,
            companyEName,
            recordId,
            signerEName: this.eName(signer),
            record,
            redirectUri: this.callbackUrl,
            message,
        });
        const signature = await this.walletSigns(signer, request.uri, message);
        await writeRecord(companyEName, recordId, ontology, {
            ...record,
            authorization: {
                signerEName: request.signerEName,
                signedPayload: request.payload,
                signature,
                signedAt: request.signedAt,
            },
        });
        this.note(
            this.eName(signer),
            `wrote "${message}" into the company eVault`,
            recordId,
        );
    }

    private async walletSigns(
        person: string,
        uri: string,
        what: string,
    ): Promise<string> {
        const session = new URL(
            uri.replace(/^w3ds:\/\//, "https://w3ds.invalid/"),
        ).searchParams.get("session") as string;
        const signed = new Promise<string>((resolve, reject) => {
            this.pending.set(session, resolve);
            setTimeout(
                () => reject(new Error("wallet never called back")),
                15_000,
            );
        });
        this.note(this.eName(person), `scans w3ds://sign: ${what}`, uri);
        await scanSignRequest(uri, {
            eName: this.eName(person),
            keyId: this.state.people[person].keyId,
            adapter: this.adapter,
        });
        return signed;
    }

    // ---- signing for the company --------------------------------------

    /** `person` signs `document` for Acme under a delegation, and eSigner verifies it. */
    async signFor(
        person: string,
        delegation: string,
        scope: string,
        document: string,
    ) {
        const company = this.requireCompany();
        const delegationId = company.delegations[delegation];
        const title = config.delegations[delegation]?.title ?? "Owner";
        const request = buildDelegatedSignRequest({
            onBehalfOf: company.eName,
            signer: this.eName(person),
            scope,
            delegationId,
            documentHash: createHash("sha256").update(document).digest("hex"),
            session: randomUUID(),
            redirectUri: this.callbackUrl,
            title,
            companyName: config.company.name,
        });
        const signature = await this.walletSigns(
            person,
            request.uri,
            `sign ${document} as ${title}`,
        );
        const result = await verifyDelegatedSignature({
            payload: request.payload,
            signature,
            registryBaseUrl: REGISTRY_URL,
            platformToken: await platformToken(),
        });
        this.note(
            undefined,
            result.valid
                ? `eSigner verified: ${config.people[person].name} signed ${document} for Acme as "${result.title}"`
                : `eSigner refused: ${result.error}${result.detail ? ` (${result.detail})` : ""}`,
        );
        if (result.valid) {
            await writeRecord(
                company.eName,
                newRecordId(),
                DELEGATED_SIGNATURE_ONTOLOGY,
                {
                    companyEName: company.eName,
                    signerEName: this.eName(person),
                    delegationId,
                    title: result.title,
                    scope,
                    documentHash: result.payload?.documentHash,
                    session: result.payload?.session,
                    signedPayload: request.payload,
                    signature,
                    platformEName: "@company-delegation-demo",
                    signedAt: now(),
                    createdAt: now(),
                },
            );
        }
        const trace = await this.trace(delegationId, scope, result);
        return { result, payload: request.payload, signature, trace };
    }

    /**
     * The path a verifier walks for a signature: from the signer's delegation
     * up through each parent to the role and the board, with the hop where it
     * broke, if it did.
     */
    private async trace(
        delegationId: string,
        scope: string,
        result: VerifyDelegatedSignatureResult,
    ): Promise<TraceStep[]> {
        const company = this.requireCompany();
        const keyOf = (eName: string) =>
            Object.entries(this.state.people).find(
                ([, p]) => p.eName === eName,
            )?.[0];
        const name = (eName: string) =>
            config.people[keyOf(eName) ?? ""]?.name ?? "someone";

        // Where the chain evaluation stopped, read from Acme's history.
        const histories = new Map<string, ReturnType<typeof readHistory>>();
        const source = {
            versions: (id: string) => {
                if (!histories.has(id))
                    histories.set(id, readHistory(company.eName, id));
                return histories.get(id) as ReturnType<typeof readHistory>;
            },
        };
        const chain = await evaluateFromHistory({
            delegationId,
            companyEName: company.eName,
            companyId: company.companyId,
            source,
            verify: (e, p, s) => this.verifyGrant(e, p, s),
        });
        const board = await resolveBoard(
            company.companyId,
            company.eName,
            source,
            (e, p, s) => this.verifyGrant(e, p, s),
        );
        const directors = board.at(-1)?.directors ?? [];

        const steps: (TraceStep & { id: string; grantor?: string })[] = [];
        let id: string | undefined = delegationId;
        for (let i = 0; id && i < 8; i++) {
            const rec = await readRecord(company.eName, id);
            if (!rec) break;
            steps.push({
                id,
                kind: "delegation",
                person: keyOf(rec.delegateEName),
                grantor: name(rec.grantedBy),
                text: `${name(rec.delegateEName)} · ${rec.title} ← ${name(rec.grantedBy)}`,
                ok: null,
            });
            if (rec.roleId) {
                const role = await readRecord(company.eName, rec.roleId);
                steps.push({
                    id: rec.roleId,
                    kind: "role",
                    text: `role ${role?.title ?? "?"} ← ${name(role?.createdBy)}`,
                    ok: null,
                });
                steps.push({
                    id: company.companyId,
                    kind: "board",
                    person: keyOf(directors[0] ?? ""),
                    text: `board: ${directors.map(name).join(", ") || "none"}`,
                    ok: null,
                });
                break;
            }
            id = rec.parentDelegationId;
        }

        const reasons: Record<string, string> = {
            REVOKED: "revoked",
            REDELEGATION_NOT_ALLOWED: "couldn't pass it on",
            NOT_FOUND: "nobody entitled granted it",
            NOT_A_SUBSET: "wider than what was given",
            EXPIRED: "expired",
        };
        let failAt = -1;
        let reason = "";
        if (result.valid) {
            failAt = -1;
        } else if (result.error === "not_covered") {
            failAt = 0;
            reason = `doesn't cover ${scope.split(":").pop()}`;
        } else if (!chain.ok) {
            failAt = Math.max(
                0,
                steps.findIndex((s) => s.id === chain.at),
            );
            reason = reasons[chain.code] ?? chain.code.toLowerCase();
            if (chain.code === "REDELEGATION_NOT_ALLOWED")
                reason = `${steps[failAt]?.grantor ?? "the giver"} ${reason}`;
        } else {
            failAt = 0;
            reason = result.detail ?? result.error ?? "refused";
        }
        return steps.map(({ id: _id, grantor: _g, ...s }, i) => ({
            ...s,
            ok: failAt < 0 || i < failAt ? true : i === failAt ? false : null,
            reason: i === failAt ? reason : undefined,
        }));
    }

    private verifyGrant(eName: string, payload: string, signature: string) {
        const key = JSON.stringify([eName, payload, signature]);
        if (!this.checked.has(key)) {
            this.checked.set(
                key,
                verifyEnameSignature({
                    eName,
                    payload,
                    signature,
                    registryBaseUrl: REGISTRY_URL,
                }).then((r) => r.valid),
            );
        }
        return this.checked.get(key) as Promise<boolean>;
    }

    /** `from` signs a re-delegation of their own delegation to `to`. */
    private async passOn(
        from: string,
        to: string,
        title: string,
        scopes: string[],
    ) {
        const company = this.requireCompany();
        const parent = company.delegations[from];
        const id = newRecordId();
        await this.grant(
            from,
            company.eName,
            DELEGATION_ONTOLOGY,
            id,
            {
                companyEName: company.eName,
                delegateEName: this.eName(to),
                parentDelegationId: parent,
                title,
                scopes,
                mayRedelegate: false,
                grantedBy: this.eName(from),
                status: "active",
                createdAt: now(),
                updatedAt: now(),
            },
            `Pass "${title}" on to ${config.people[to].name}`,
        );
        company.delegations[`${to}-from-${from}`] = id;
        save(this.state);
        return `${to}-from-${from}`;
    }

    // ---- scenarios -----------------------------------------------------

    readonly scenarios: Record<
        string,
        { label: string; run: () => Promise<Outcome> }
    > = {
        "tim-nda": {
            label: "Tim signs an NDA for Acme",
            run: async () => {
                const { result, payload, signature, trace } =
                    await this.signFor(
                        "tim",
                        "tim",
                        "@esigner:nda",
                        "nda-globex.pdf",
                    );
                this.lastSignature = { payload, signature };
                return outcome("tim-nda", "valid", result, trace);
            },
        },
        "tim-invoice": {
            label: "Tim signs an invoice",
            run: async () => {
                const { result, trace } = await this.signFor(
                    "tim",
                    "tim",
                    "@esigner:invoice",
                    "invoice-0042.pdf",
                );
                return outcome("tim-invoice", "refused", result, trace);
            },
        },
        "tim-passes-on": {
            label: "Tim passes his badge to Mallory",
            run: async () => {
                const key = await this.passOn("tim", "mallory", "NDA signer", [
                    "@esigner:nda",
                ]);
                const { result, trace } = await this.signFor(
                    "mallory",
                    key,
                    "@esigner:nda",
                    "nda-mallory.pdf",
                );
                return outcome("tim-passes-on", "refused", result, trace);
            },
        },
        "login-replay": {
            label: "Tim's NDA signature replayed as a login",
            run: async () => {
                if (!this.lastSignature) await this.scenarios["tim-nda"].run();
                const { payload, signature } = this.lastSignature as {
                    payload: string;
                    signature: string;
                };
                const login = await verifyLoginSignature({
                    eName: this.eName("tim"),
                    signature,
                    session: payload,
                    registryBaseUrl: REGISTRY_URL,
                });
                this.note(
                    undefined,
                    `login check: ${login.valid ? "accepted" : `refused (${login.error})`}`,
                );
                return {
                    scenario: "login-replay",
                    expected: "refused",
                    passed: !login.valid,
                    summary: login.valid
                        ? "accepted as a login"
                        : `refused: ${login.error}`,
                    result: login,
                };
            },
        },
        "mallory-board": {
            label: "Mallory writes herself onto Acme's board",
            run: async () => {
                const company = this.requireCompany();
                const current =
                    (await readRecord(company.eName, company.companyId)) ?? {};
                const { authorization: _drop, ...board } = current;
                await this.grant(
                    "mallory",
                    company.eName,
                    COMPANY_ONTOLOGY,
                    company.companyId,
                    {
                        ...board,
                        directors: [this.eName("mallory")],
                        updatedAt: now(),
                    },
                    "Make Mallory the board",
                );
                const roleId = newRecordId();
                await this.grant(
                    "mallory",
                    company.eName,
                    ROLE_ONTOLOGY,
                    roleId,
                    {
                        companyEName: company.eName,
                        title: "Owner",
                        scopes: ["@esigner:nda"],
                        mayRedelegate: false,
                        status: "active",
                        createdBy: this.eName("mallory"),
                        createdAt: now(),
                        updatedAt: now(),
                    },
                    "Create role Owner",
                );
                const delegationId = newRecordId();
                await this.grant(
                    "mallory",
                    company.eName,
                    DELEGATION_ONTOLOGY,
                    delegationId,
                    {
                        companyEName: company.eName,
                        delegateEName: this.eName("mallory"),
                        roleId,
                        title: "Owner",
                        scopes: ["@esigner:nda"],
                        mayRedelegate: false,
                        grantedBy: this.eName("mallory"),
                        status: "active",
                        createdAt: now(),
                        updatedAt: now(),
                    },
                    "Delegate Owner to Mallory",
                );
                company.delegations.mallory = delegationId;
                save(this.state);
                const { result, trace } = await this.signFor(
                    "mallory",
                    "mallory",
                    "@esigner:nda",
                    "nda-mallory.pdf",
                );
                return outcome("mallory-board", "refused", result, trace);
            },
        },
        "revoke-bob": {
            label: "Dana revokes Bob, then Tim signs again",
            run: async () => {
                const company = this.requireCompany();
                const current =
                    (await readRecord(
                        company.eName,
                        company.delegations.bob,
                    )) ?? {};
                const { authorization: _drop, ...delegation } = current;
                await this.grant(
                    "dana",
                    company.eName,
                    DELEGATION_ONTOLOGY,
                    company.delegations.bob,
                    {
                        ...delegation,
                        status: "revoked",
                        revokedAt: now(),
                        revokedBy: this.eName("dana"),
                        revocationReason: "revoked",
                        updatedAt: now(),
                    },
                    "Revoke Bob's delegation",
                );
                const { result, trace } = await this.signFor(
                    "tim",
                    "tim",
                    "@esigner:nda",
                    "nda-after-revoke.pdf",
                );
                return outcome("revoke-bob", "refused", result, trace);
            },
        },
    };

    // ---- view ------------------------------------------------------------

    /** Acme's records as stored, and as a verifier resolves them. */
    private async view() {
        const company = this.state.company;
        if (!company) return null;
        return {
            records: await this.records(),
            verified: await this.verifiedView(),
        };
    }

    private async records() {
        const company = this.state.company;
        return company
            ? {
                  company: await readRecord(company.eName, company.companyId),
                  roles: await Promise.all(
                      Object.values(company.roles).map((id) =>
                          readRecord(company.eName, id),
                      ),
                  ),
                  delegations: await Promise.all(
                      Object.entries(company.delegations).map(
                          async ([key, id]) => ({
                              key,
                              id,
                              record: await readRecord(company.eName, id),
                          }),
                      ),
                  ),
              }
            : null;
    }

    /**
     * The page's state. Reading Acme's history costs eVault requests, so the
     * view is only recomputed after setup, reset or a scenario changed it.
     */
    async snapshot(refresh = false) {
        const company = this.state.company;
        if (refresh || this.cachedView === undefined)
            this.cachedView = await this.view();
        const view = this.cachedView;
        if (company && !this.setupView) this.setupView = view;
        return {
            people: Object.fromEntries(
                Object.entries(this.state.people).map(([k, p]) => [
                    k,
                    { ...config.people[k], eName: p.eName },
                ]),
            ),
            company: company
                ? { eName: company.eName, companyId: company.companyId }
                : null,
            records: view?.records ?? null,
            setupView: this.setupView,
            // MetaEnvelope ids, so the page can show where each record lives.
            ids: company
                ? {
                      company: company.companyId,
                      roles: company.roles,
                      delegations: company.delegations,
                  }
                : null,
            scenarios: Object.entries(this.scenarios).map(([id, s]) => ({
                id,
                label: s.label,
            })),
            verified: view?.verified ?? null,
            outcomes: this.outcomes,
            log: this.log.slice(-60),
        };
    }

    /**
     * Scenarios can run in any order, so each first gets what it needs: an
     * Acme that exists in its eVault, and for the ones that rely on Tim's
     * chain, one where Bob has not been revoked. Anything else starts a fresh
     * Acme.
     */
    private async heal(id: string): Promise<void> {
        const company = this.state.company;
        let usable = false;
        if (company) {
            try {
                usable =
                    (await readRecord(company.eName, company.companyId)) !==
                    null;
            } catch {
                usable = false;
            }
        }
        const needsChain = ["tim-nda", "tim-invoice", "tim-passes-on"].includes(
            id,
        );
        const chainBroken = needsChain && !!this.outcomes["revoke-bob"];
        if (usable && !chainBroken) return;
        const why = !company
            ? "no Acme yet: founding it first"
            : chainBroken
              ? "Bob was revoked on this Acme: founding a fresh one"
              : "Acme's eVault is gone: founding a fresh one";
        this.reset();
        this.note(undefined, why);
        await this.setup();
        this.cachedView = await this.view();
        this.setupView = this.cachedView;
    }

    private requireCompany() {
        if (!this.state.company) throw new Error("run setup first");
        return this.state.company;
    }

    private eName(person: string) {
        const p = this.state.people[person];
        if (!p) throw new Error(`unknown person ${person}`);
        return p.eName;
    }

    private note(who: string | undefined, text: string, detail?: string) {
        this.log.push({ at: now(), who, text, detail });
    }
}

function describe(result: VerifyDelegatedSignatureResult) {
    return result.valid
        ? `valid as "${result.title}"`
        : `refused: ${result.error}${result.detail ? ` (${result.detail})` : ""}`;
}

function outcome(
    scenario: string,
    expected: "valid" | "refused",
    result: VerifyDelegatedSignatureResult,
    trace?: TraceStep[],
): Outcome {
    return {
        trace,
        scenario,
        expected,
        passed: expected === "valid" ? result.valid : !result.valid,
        summary: describe(result),
        result,
    };
}

function load(): State {
    try {
        return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
    } catch {
        return { keys: {}, people: {} };
    }
}

function save(state: State) {
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
