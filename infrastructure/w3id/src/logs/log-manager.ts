import {
    CreateLogEventOptions,
    GenesisLogOptions,
    LogEvent,
    LogEvents,
    RotationLogOptions,
    VerifierCallback,
} from "./log.types";
import { StorageSpec } from "./storage/storage-spec";
import { hash } from "../utils/hash";
import canonicalize from "canonicalize";
import { isSubsetOf } from "../utils/array";
import {
    BadSignatureError,
    MalformedHashChainError,
    MalformedIndexChainError,
} from "../errors/errors";

/**
 * Class to generate historic event logs for all historic events for an Identifier
 * starting with generating it's first log entry
 */

// TODO: Create a specification link inside our docs for how generation of identifier works

export class IDLogManager {
    repository: StorageSpec<LogEvent, LogEvent>;

    constructor(repository: StorageSpec<LogEvent, LogEvent>) {
        this.repository = repository;
    }

    static async validateLogChain(
        log: LogEvent[],
        verifyCallback: VerifierCallback,
    ) {
        let currIndex: number = 0;
        let currentNextKeyHashesSeen: string[] = [];
        let lastUpdateKeysSeen: string[] = [];
        let lastHash: string;

        for (const e of log) {
            let [_index, _hash] = e.versionId.split("-");
            const index = Number(_index);
            if (currIndex !== index) throw new MalformedIndexChainError();
            const hashedUpdateKeys = await Promise.all(
                e.updateKeys.map(async (k) => await hash(k)),
            );
            if (index > 0) {
                const updateKeysSeen = isSubsetOf(
                    hashedUpdateKeys,
                    currentNextKeyHashesSeen,
                );
                if (!updateKeysSeen || lastHash !== _hash)
                    throw new MalformedHashChainError();
            }

            currentNextKeyHashesSeen = e.nextKeyHashes;
            await this.verifyLogEventProof(
                e,
                lastUpdateKeysSeen.length > 0
                    ? lastUpdateKeysSeen
                    : e.updateKeys,
                verifyCallback,
            );
            lastUpdateKeysSeen = e.updateKeys;
            currIndex++;
            lastHash = await hash(canonicalize(e) as string);
        }
        return true;
    }

    private static async verifyLogEventProof(
        e: LogEvent,
        currentUpdateKeys: string[],
        verifyCallback: VerifierCallback,
    ) {
        const proof = e.proof;
        const copy = JSON.parse(JSON.stringify(e));
        delete copy.proof;
        const canonicalJson = canonicalize(copy);
        let verified = false;
        if (!proof) throw new Error();
        for (const key of currentUpdateKeys) {
            const signValidates = await verifyCallback(
                canonicalJson as string,
                proof,
                key,
            );
            if (signValidates) verified = true;
        }
        if (!verified) throw new BadSignatureError();
    }

    private async appendEntry(
        entries: LogEvent[],
        options: RotationLogOptions,
    ) {
        const { signer, nextKeyHashes, nextKeySigner } = options;
        const latestEntry = entries[entries.length - 1];
        const logHash = await hash(latestEntry);
        const index = Number(latestEntry.versionId.split("-")[0]) + 1;

        const currKeyHash = await hash(nextKeySigner.pubKey);
        if (!latestEntry.nextKeyHashes.includes(currKeyHash)) throw new Error();

        const logEvent: LogEvent = {
            id: latestEntry.id,
            versionTime: new Date(Date.now()),
            versionId: `${index}-${logHash}`,
            updateKeys: [nextKeySigner.pubKey],
            nextKeyHashes: nextKeyHashes,
            // TODO: integrate this shit with the actual version of the package.json
            method: `w3id:v0.0.0`,
        };

        const proof = await signer.sign(canonicalize(logEvent) as string);
        logEvent.proof = proof;

        await this.repository.create(logEvent);
        return logEvent;
    }

    private async createGenesisEntry(options: GenesisLogOptions) {
        const { id, nextKeyHashes, signer } = options;
        const logEvent: LogEvent = {
            id,
            versionId: `0-${id.split("@")[1]}`,
            versionTime: new Date(Date.now()),
            updateKeys: [signer.pubKey],
            nextKeyHashes: nextKeyHashes,
            // TODO: integrate this shit with the actual version of the package.json
            method: `w3id:v0.0.0`,
        };
        const proof = await signer.sign(canonicalize(logEvent) as string);
        logEvent.proof = proof;
        await this.repository.create(logEvent);
        return logEvent;
    }

    async createLogEvent(options: CreateLogEventOptions) {
        const entries = await this.repository.findMany({});
        if (options.type === LogEvents.Genesis)
            return this.createGenesisEntry(options);
        return this.appendEntry(entries, options);
    }
}
