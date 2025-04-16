import { base58btc } from "multiformats/bases/base58";
import { Signer, VerifierCallback } from "../../src/logs/log.types";
import {
    hexToUint8Array,
    stringToUint8Array,
    uint8ArrayToHex,
} from "../../src/utils/codec";
import nacl from "tweetnacl";

export const verifierCallback: VerifierCallback = async (
    message: string,
    signature: string,
    pubKey: string,
) => {
    const signatureBuffer = base58btc.decode(signature);
    const messageBuffer = stringToUint8Array(message);
    const publicKey = hexToUint8Array(pubKey);
    const isValid = nacl.sign.detached.verify(
        messageBuffer,
        signatureBuffer,
        publicKey,
    );

    return isValid;
};

export function createSigner(keyPair: nacl.SignKeyPair): Signer {
    const publicKey = uint8ArrayToHex(keyPair.publicKey);
    const signer: Signer = {
        pubKey: publicKey,
        sign: (str: string) => {
            const buffer = stringToUint8Array(str);
            const signature = nacl.sign.detached(buffer, keyPair.secretKey);
            return base58btc.encode(signature);
        },
    };
    return signer;
}
