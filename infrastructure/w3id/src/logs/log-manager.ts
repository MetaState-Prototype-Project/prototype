import {
    CreateLogEventOptions,
    GenesisLogOptions,
    LogEvent,
    LogEvents,
    RotationLogOptions,
} from "./log.types";
import { StorageSpec } from "./storage/storage-spec";

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
        const latestEntry = entries[entries.length - 1];
    }

    private async createGenesisEntry(options: GenesisLogOptions) {
        const { id, nextPubKey, signer } = options;
        const logEvent: LogEvent = {
            id,
            versionId: `0-${id}`,
            versionTime: new Date(Date.now()),
            updateKeys: [signer.pubKey],
            nextKeyHashes: [nextPubKey],
            // TODO: integrate this shit with the actual version of the package.json
            method: `w3id:v0.0.0`,
        };
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
