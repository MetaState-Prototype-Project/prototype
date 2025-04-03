import { LogEvent } from "./log.types";
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

    private async appendEntry(entries: LogEvent[]) {}

    private async createGenesisEntry() {}

    async createLogEvent() {
        const entries = await this.logsRepository.findMany({});
        if (entries.length > 0) return this.appendEntry(entries);
        return this.createGenesisEntry();
    }
}
