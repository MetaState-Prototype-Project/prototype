# Soil Import Ontologies

These agriculture schemas describe the records currently written by the W3DS
Soil Samples importer. The importer accepts Eurofins XML and canonical JSON.
The field names, optional fields and schema IDs preserve compatibility with
existing records. IDs that look repetitive are already used by the importer;
they are intentionally retained rather than silently changing stored types.

| Schema | schemaId | Purpose |
| --- | --- | --- |
| SoilImportBundle | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | Import manifest |
| SoilLabReport | 11111111-1111-4111-8111-111111111111 | Report provenance |
| SoilSample | 22222222-2222-4222-8222-222222222222 | Sample identity and field link |
| SoilSamplingEvent | 33333333-3333-4333-8333-333333333333 | Dates, depth and sampling protocol |
| SoilSampledObject | 44444444-4444-4444-8444-444444444444 | Sample location and parcel context |
| SoilParty | 55555555-5555-4555-8555-555555555555 | Producer, customer, sender or recipient |
| SoilObservation | 66666666-6666-4666-8666-666666666666 | Original and normalized results |
| SoilMethod | 77777777-7777-4777-8777-777777777777 | Laboratory method |
| SoilInterpretation | 88888888-8888-4888-8888-888888888888 | Optional sourced interpretation |
| SoilRecommendation | 99999999-9999-4999-8999-999999999999 | Optional sourced recommendation |

Schemas live in `services/ontology/schemas/soil*.json` and use JSON Schema
draft-07. The ontology service discovers JSON files automatically. Each schema
declares `domain: agriculture` and a `$id` under the ontology service URL.
Registration in source control and deployment of that service are separate
steps; the service URL becomes available after merge and deployment.

## References

Every record's `id` is its application ID inside the payload. It is distinct
from the containing MetaEnvelope ID. The import manifest references payload
IDs through `source_file_id`, `lab_report_id`, `soil_sample_id`,
`sampling_event_id`, `sampled_object_id`, and its arrays of related IDs.
Child records carry optional `bundle_id`, preserving older records that
predate import manifests. Observations reference their sample, report and
optional method; interpretations may reference a particular observation.

`field_w3id` in SoilSample and SoilSampledObject is an exception: it is the
MetaEnvelope ID of a crop field in the owner's eVault. It is not a provider's
external field identifier. Linking or changing a field updates both records;
unlinking removes the property from both. The importer currently discovers
FarmMaps crop fields using ontology ID `562a705a-4bb5-4130-9b0b-2d419910e0cf`.
These schemas do not introduce or redefine the field ontology.

## Measurements and interpretation

SoilObservation retains source codes, labels, units, qualifiers and quality
flags separately from normalized values. It is a distinct payload contract
from the existing general `Observation` schema, so that schema is unchanged.
Numeric values are optional because laboratories can report textual or
qualified results. The schema does not assert agronomic thresholds, unit
convertibility or comparability between laboratory methods.

SoilInterpretation and SoilRecommendation reserve the payload contracts used
by the importer; current Eurofins parsing does not populate them. Registering
these types does not manufacture recommendations or persist UI reference
classifications as laboratory judgments.

## Original files

The importer currently stores original bytes under the existing File ontology
ID `a1b2c3d4-e5f6-7890-abcd-ef1234567890`. No duplicate File schema is added.
There is a known separate compatibility issue: the importer writes legacy
snake_case fields such as `file_name`, `mime_type`, `byte_size`, `sha256` and
`owner_eid`, whereas the registered File schema requires fields such as
`name`, `mimeType`, `size`, `md5Hash` and `ownerId`. This registration does not
resolve or hide that mismatch. Adapting the File writer and migrating existing
file records requires a separate change in the importing application.
