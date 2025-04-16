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

	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * charsLength));
	}

	return result;
}
