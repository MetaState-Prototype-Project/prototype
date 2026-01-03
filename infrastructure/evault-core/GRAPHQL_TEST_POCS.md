# GraphQL Authorization Test POCs

These are proof-of-concept curl commands to test GraphQL authorization. After the fix, all operations **REQUIRE**:
- A valid Bearer token in the Authorization header (MANDATORY)

**EXCEPTION:** `storeMetaEnvelope` mutation only requires X-ENAME header (Bearer token is optional but allowed).

**IMPORTANT:** For all other operations, X-ENAME header alone is NOT sufficient for authentication. A Bearer token is ALWAYS required.

## Server Configuration
Replace `http://64.227.64.55:4000` with your actual server URL.

## Test eName
Replace `@911253cf-885e-5a71-b0e4-c9df4cb6cd40` with a valid eName for your tests (used for data filtering, not authentication).

## Test Token
Replace `YOUR_BEARER_TOKEN` with a valid JWT token from your registry. This is REQUIRED for all operations.

---

## QUERIES

### 1. getAllEnvelopes

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "{ getAllEnvelopes { id ontology value } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "{ getAllEnvelopes { id ontology value } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "{ getAllEnvelopes { id ontology value } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

### 2. getMetaEnvelopeById

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "{ getMetaEnvelopeById(id: \"test-envelope-id\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "{ getMetaEnvelopeById(id: \"test-envelope-id\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "{ getMetaEnvelopeById(id: \"test-envelope-id\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

### 3. findMetaEnvelopesByOntology

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "{ findMetaEnvelopesByOntology(ontology: \"TestOntology\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "{ findMetaEnvelopesByOntology(ontology: \"TestOntology\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "{ findMetaEnvelopesByOntology(ontology: \"TestOntology\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

### 4. searchMetaEnvelopes

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "{ searchMetaEnvelopes(ontology: \"TestOntology\", term: \"search-term\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "{ searchMetaEnvelopes(ontology: \"TestOntology\", term: \"search-term\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "{ searchMetaEnvelopes(ontology: \"TestOntology\", term: \"search-term\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

## MUTATIONS

### 5. storeMetaEnvelope

**SPECIAL CASE: storeMetaEnvelope only requires X-ENAME (no Bearer token needed)**

**Without X-ENAME (Should FAIL):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With X-ENAME (Should WORK - Bearer token NOT required for storeMetaEnvelope):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is optional but allowed):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

---

### 6. updateMetaEnvelopeById

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "mutation { updateMetaEnvelopeById(id: \"test-envelope-id\", input: { ontology: \"TestOntology\", payload: { test: \"updated-data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "mutation { updateMetaEnvelopeById(id: \"test-envelope-id\", input: { ontology: \"TestOntology\", payload: { test: \"updated-data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "mutation { updateMetaEnvelopeById(id: \"test-envelope-id\", input: { ontology: \"TestOntology\", payload: { test: \"updated-data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

### 7. deleteMetaEnvelope

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "mutation { deleteMetaEnvelope(id: \"test-envelope-id\") }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "mutation { deleteMetaEnvelope(id: \"test-envelope-id\") }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "mutation { deleteMetaEnvelope(id: \"test-envelope-id\") }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

### 8. updateEnvelopeValue

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "mutation { updateEnvelopeValue(envelopeId: \"test-envelope-id\", newValue: { updated: \"value\" }) }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With ONLY eName (Should FAIL - eName alone is NOT sufficient):**
```bash
echo '{ "query": "mutation { updateEnvelopeValue(envelopeId: \"test-envelope-id\", newValue: { updated: \"value\" }) }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK - Bearer token is REQUIRED):**
```bash
echo '{ "query": "mutation { updateEnvelopeValue(envelopeId: \"test-envelope-id\", newValue: { updated: \"value\" }) }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
--header "Content-Type: application/json" \
--data @-
```

---

## Expected Behavior After Fix

### Before Fix (VULNERABLE):
- Operations without authorization would execute and return data
- `getAllEnvelopes` could be called without any auth headers
- X-ENAME alone was incorrectly accepted as authentication

### After Fix (SECURE):
- All operations **REQUIRE** a valid Bearer token in the Authorization header
- **EXCEPTION:** `storeMetaEnvelope` mutation only requires X-ENAME (Bearer token is optional)
- Operations without valid Bearer token (except storeMetaEnvelope) will return an error:
  ```json
  {
    "errors": [{
      "message": "Authentication required: A valid Bearer token in Authorization header is required"
    }]
  }
  ```
- X-ENAME alone is **NOT sufficient** for most operations (except storeMetaEnvelope)
- Operations with valid Bearer token will work
- X-ENAME can still be provided for data filtering purposes, but Bearer token is mandatory (except for storeMetaEnvelope)

## Testing Checklist

- [ ] Test all queries without auth (should all fail)
- [ ] Test all queries with ONLY eName (should all fail - eName alone is NOT sufficient)
- [ ] Test all queries with Bearer token (should all work - Bearer token is REQUIRED)
- [ ] Test storeMetaEnvelope without X-ENAME (should fail)
- [ ] Test storeMetaEnvelope with ONLY X-ENAME (should work - special case)
- [ ] Test storeMetaEnvelope with Bearer token (should work - optional)
- [ ] Test all other mutations without auth (should all fail)
- [ ] Test all other mutations with ONLY eName (should all fail - eName alone is NOT sufficient)
- [ ] Test all other mutations with Bearer token (should all work - Bearer token is REQUIRED)
- [ ] Test with invalid Bearer token (should fail)
- [ ] Test with missing Bearer token (should fail)

