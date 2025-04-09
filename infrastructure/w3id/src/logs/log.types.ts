export type LogEvent = {
    id: string;
    versionId: string;
    versionTime: Date;
    updateKeys: string[];
    nextKeyHashes: string[];
    method: `w3id:v${string}`;
    proof?: string;
};

export enum LogEvents {
    Rotation,
    Genesis,
}

export type RotationLogOptions = {
    type: LogEvents.Rotation;
    nextKeyHashes: string[];
    signer: Signer;
    nextKeySigner: Signer;
};

export type GenesisLogOptions = {
    type: LogEvents.Genesis;
    nextKeyHashes: string[];
    id: string;
    signer: Signer;
};

export type Signer = {
    sign: (string: string) => Promise<string> | string;
    pubKey: string;
};

export type CreateLogEventOptions = GenesisLogOptions | RotationLogOptions;
