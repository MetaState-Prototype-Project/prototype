import { m } from "$lib/i18n";
import { getLocale } from "$lib/paraglide/runtime";

// Identity fields are persisted under their English labels (see
// UserController), so the stored key doubles as the lookup key and stored
// data survives a language switch. Provider values pass through as-is.

const FIELD_LABELS: Record<string, () => string> = {
    name: m.identity_name,
    "Date of Birth": m.identity_date_of_birth,
    "ID submitted": m.identity_id_submitted,
    "Document Number": m.identity_document_number,
    "Passport Number": m.identity_passport_number,
    "Valid From": m.identity_valid_from,
    "Valid Until": m.identity_valid_until,
    "Verified On": m.identity_verified_on,
};

const FIELD_VALUES: Record<string, () => string> = {
    Verified: m.identity_value_verified,
    "Anonymous — Self Declaration": m.identity_value_anonymous,
};

export function identityFieldLabel(field: string): string {
    return FIELD_LABELS[field]?.() ?? field;
}

// Captured through toDateString(), so the stored value is an English date
// string. Reformatting at display keeps what is already stored readable
// without migrating it.
const DATE_FIELDS = new Set([
    "Date of Birth",
    "Valid From",
    "Valid Until",
    "Verified On",
]);

export function identityFieldValue(value: string, fieldName?: string): string {
    if (fieldName && DATE_FIELDS.has(fieldName)) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return new Intl.DateTimeFormat(getLocale(), {
                year: "numeric",
                month: "long",
                day: "numeric",
            }).format(parsed);
        }
    }
    return FIELD_VALUES[value]?.() ?? value;
}
