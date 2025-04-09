import {
    CreateLogEventOptions,
    GenesisLogOptions,
    LogEvent,
    LogEvents,
    RotationLogOptions,
} from "./log.types";
import { StorageSpec } from "./storage/storage-spec";
import { hash } from "../utils/hash";
import canonicalize from "canonicalize";

/**
 * Class to generate historic event logs for all historic events for an Identifier
 * starting with generating it's first log entry
 */

// TODO: Create a specification link inside our docs for how generation of identifier works

export class IDLogManager {
    private logsRepository: StorageSpec<LogEvent, LogEvent>;

    constructor(logsRepository: StorageSpec<LogEvent, LogEvent>) {
        this.logsRepository = logsRepository;
    }

    private async appendEntry(
        entries: LogEvent[],
        options: RotationLogOptions,
    ) {
        const { signer, nextKeyHashes, nextKeySigner } = options;
        const latestEntry = entries[entries.length - 1];
        const logHash = hash(latestEntry);
        const index = Number(latestEntry.id.split("-")[0]) + 1;

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

        const proof = await options.signer.sign(
            canonicalize(logEvent) as string,
        );
        logEvent.proof = proof;

        await this.logsRepository.create(logEvent);

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
        await this.logsRepository.create(logEvent);
        return logEvent;
    }

    async createLogEvent(options: CreateLogEventOptions) {
        const entries = await this.logsRepository.findMany({});
        if (options.type === LogEvents.Genesis)
            return this.createGenesisEntry(options);
        return this.appendEntry(entries, options);
    }
}
