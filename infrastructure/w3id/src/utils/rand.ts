/**
 * Generate a random alphanumeric sequence with set length
 *
 * @param {number} length length of the alphanumeric string you want
 * @returns {string}
 */

export function generateRandomAlphaNum(length = 16): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charsLength = chars.length;
    const randomValues = new Uint32Array(length);

    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        result += chars.charAt(randomValues[i] % charsLength);
    }

    return result;
}
