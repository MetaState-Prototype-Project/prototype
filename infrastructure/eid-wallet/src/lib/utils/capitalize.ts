/**
 * Returns a new string with the first letter of each word in uppercase and the remaining letters in lowercase.
 *
 * @param str - The input string to capitalize.
 * @returns The capitalized string.
 */
export function capitalize(str: string) {
    return str
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
