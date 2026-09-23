import { m } from "$lib/i18n";

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

export function identityFieldValue(value: string): string {
    return FIELD_VALUES[value]?.() ?? value;
}
