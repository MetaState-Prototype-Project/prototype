/**
 * Get the language name with the country name in parentheses
 * @param {string} locale - The locale code
 * @returns {object} - The language code and name
 *
 * @example
 * getLanguageWithCountry('en-GB') // { code: 'gb', name: 'English (United Kingdom)' }
 * getLanguageWithCountry('es') // { code: 'es', name: 'Spanish' }
 */
export const getLanguageWithCountry = (locale: string) => {
	const parts = locale.split("-");
	const langCode = parts[0];
	const countryCode = parts[1]?.toLowerCase() || "";

	return {
		code: countryCode || langCode,
		name:
			new Intl.DisplayNames(["en"], { type: "language" }).of(langCode) +
			(countryCode
				? ` (${new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase())})`
				: ""),
	};
};
