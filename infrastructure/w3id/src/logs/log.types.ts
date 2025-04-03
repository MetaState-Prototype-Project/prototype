export type LogEvent = {
    versionId: string;
    versionTime: Date;
    updateKeys: string[];
    nextKeyHashes: string[];
    method: `w3id:v${number}.${number}.${number}`;
    uuid: string;
};
