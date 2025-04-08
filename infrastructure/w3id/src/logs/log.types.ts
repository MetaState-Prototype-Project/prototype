export type LogEvent = {
    id: string;
    versionId: string;
    versionTime: Date;
    updateKeys: string[];
    nextKeyHashes: string[];
    method: `w3id:v${string}`;
};

export enum LogEvents {
    Rotation,
    Genesis,
}

export type RotationLogOptions = {
    type: LogEvents.Rotation;
    nextKeyHashes: string[];
    updateKeys: string[];
};

export type GenesisLogOptions = {
    type: LogEvents.Genesis;
    nextPubKey: string;
    id: string;
    signer: Signer;
};

export type Signer = {
    sign: (string: string) => Promise<string> | string;
    pubKey: string;
};

export type CreateLogEventOptions = GenesisLogOptions | RotationLogOptions;
