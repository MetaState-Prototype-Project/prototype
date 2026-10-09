import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildDelegatedSignRequest,
    buildGrantSignRequest,
    verifyDelegatedSignature,
    verifyLoginSignature,
    type VerifyDelegatedSignatureResult,
} from "@metastate-foundation/auth";
import {
    COMPANY_ONTOLOGY,
    DELEGATED_SIGNATURE_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
} from "@metastate-foundation/delegation";
import { provision, syncPublicKeyToEvaultWithOptions } from "wallet-sdk";
import {
    newRecordId,
    platformToken,
    PROVISIONER_URL,
    provisionKeylessEVault,
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
};

const now = () => new Date().toISOString();

export class Demo {
    private state: State;
    private adapter: NodeWalletAdapter;
    private pending = new Map<string, (signature: string) => void>();
    readonly log: LogEntry[] = [];
    private lastBobSignature?: { payload: string; signature: string };

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
    }

    // ---- setup ---------------------------------------------------------

    async setup(): Promise<void> {
        for (const key of Object.keys(config.people)) await this.person(key);
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

    /** `person` signs `document` for Acme under their delegation, and a platform verifies it. */
    async signFor(
        person: string,
        delegation: string,
        scope: string,
        document: string,
    ) {
        const company = this.requireCompany();
        const title = config.delegations[delegation]?.title ?? "someone";
        const request = buildDelegatedSignRequest({
            onBehalfOf: company.eName,
            signer: this.eName(person),
            scope,
            delegationId: company.delegations[delegation],
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
                ? `platform verified: ${config.people[person].name} signed ${document} for Acme as "${result.title}"`
                : `platform refused: ${result.error}${result.detail ? ` (${result.detail})` : ""}`,
        );
        if (result.valid) {
            await writeRecord(
                company.eName,
                newRecordId(),
                DELEGATED_SIGNATURE_ONTOLOGY,
                {
                    companyEName: company.eName,
                    signerEName: this.eName(person),
                    delegationId: company.delegations[delegation],
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
        return { result, payload: request.payload, signature };
    }

    // ---- scenarios -----------------------------------------------------

    readonly scenarios: Record<
        string,
        { label: string; run: () => Promise<Outcome> }
    > = {
        "bob-nda": {
            label: "Bob signs an NDA for Acme",
            run: async () => {
                const { result, payload, signature } = await this.signFor(
                    "bob",
                    "bob",
                    "@esigner:nda",
                    "nda-globex.pdf",
                );
                this.lastBobSignature = { payload, signature };
                return outcome("bob-nda", "valid", result);
            },
        },
        "bob-invoice": {
            label: "Bob signs an invoice (not in his delegation)",
            run: async () =>
                outcome(
                    "bob-invoice",
                    "refused",
                    (
                        await this.signFor(
                            "bob",
                            "bob",
                            "@esigner:invoice",
                            "invoice-0042.pdf",
                        )
                    ).result,
                ),
        },
        "carol-nda": {
            label: "Carol signs an NDA (re-delegated by Bob)",
            run: async () =>
                outcome(
                    "carol-nda",
                    "valid",
                    (
                        await this.signFor(
                            "carol",
                            "carol",
                            "@esigner:nda",
                            "nda-initech.pdf",
                        )
                    ).result,
                ),
        },
        "login-replay": {
            label: "Bob's NDA signature replayed as a login",
            run: async () => {
                if (!this.lastBobSignature)
                    await this.scenarios["bob-nda"].run();
                const { payload, signature } = this.lastBobSignature as {
                    payload: string;
                    signature: string;
                };
                const login = await verifyLoginSignature({
                    eName: this.eName("bob"),
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
            label: "Mallory writes herself onto Acme's board and delegates to herself",
            run: async () => {
                const company = this.requireCompany();
                const current =
                    (await readRecord(company.eName, company.companyId)) ?? {};
                const { authorization: _drop, ...board } = current;
                // A version signed by Mallory over the real Company record.
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
                return outcome(
                    "mallory-board",
                    "refused",
                    (
                        await this.signFor(
                            "mallory",
                            "mallory",
                            "@esigner:nda",
                            "nda-mallory.pdf",
                        )
                    ).result,
                );
            },
        },
        "revoke-bob": {
            label: "Dana revokes Bob, then Bob and Carol try again",
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
                const bob = (
                    await this.signFor(
                        "bob",
                        "bob",
                        "@esigner:nda",
                        "nda-after-revoke.pdf",
                    )
                ).result;
                const carol = (
                    await this.signFor(
                        "carol",
                        "carol",
                        "@esigner:nda",
                        "nda-after-revoke.pdf",
                    )
                ).result;
                const passed = !bob.valid && !carol.valid;
                return {
                    scenario: "revoke-bob",
                    expected: "refused",
                    passed,
                    summary: `Bob: ${describe(bob)} · Carol: ${describe(carol)}`,
                    result: { bob, carol },
                };
            },
        },
    };

    // ---- view ------------------------------------------------------------

    async snapshot() {
        const company = this.state.company;
        const records = company
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
            records,
            scenarios: Object.entries(this.scenarios).map(([id, s]) => ({
                id,
                label: s.label,
            })),
            log: this.log.slice(-60),
        };
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
): Outcome {
    return {
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
