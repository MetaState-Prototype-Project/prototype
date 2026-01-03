# GraphQL Authorization Test POCs

These are proof-of-concept curl commands to test GraphQL authorization. After the fix, all operations should require either:
- A valid Bearer token in the Authorization header, OR
- A valid X-ENAME header

## Server Configuration
Replace `http://64.227.64.55:4000` with your actual server URL.

## Test eName
Replace `@911253cf-885e-5a71-b0e4-c9df4cb6cd40` with a valid eName for your tests.

## Test Token
Replace `YOUR_BEARER_TOKEN` with a valid JWT token from your registry.

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

**With eName (Should WORK):**
```bash
echo '{ "query": "{ getAllEnvelopes { id ontology value } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**With eName (Should WORK):**
```bash
echo '{ "query": "{ getMetaEnvelopeById(id: \"test-envelope-id\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**With eName (Should WORK):**
```bash
echo '{ "query": "{ findMetaEnvelopesByOntology(ontology: \"TestOntology\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**With eName (Should WORK):**
```bash
echo '{ "query": "{ searchMetaEnvelopes(ontology: \"TestOntology\", term: \"search-term\") { id ontology envelopes { id value } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**Without Authorization (Should FAIL):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Content-Type: application/json" \
--data @-
```

**With eName (Should WORK):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
```bash
echo '{ "query": "mutation { storeMetaEnvelope(input: { ontology: \"TestOntology\", payload: { test: \"data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "Authorization: Bearer YOUR_BEARER_TOKEN" \
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

**With eName (Should WORK):**
```bash
echo '{ "query": "mutation { updateMetaEnvelopeById(id: \"test-envelope-id\", input: { ontology: \"TestOntology\", payload: { test: \"updated-data\" }, acl: [\"user-123\"] }) { metaEnvelope { id ontology } envelopes { id } } }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**With eName (Should WORK):**
```bash
echo '{ "query": "mutation { deleteMetaEnvelope(id: \"test-envelope-id\") }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

**With eName (Should WORK):**
```bash
echo '{ "query": "mutation { updateEnvelopeValue(envelopeId: \"test-envelope-id\", newValue: { updated: \"value\" }) }" }' | tr -d '\n' | curl --silent \
http://64.227.64.55:4000/graphql \
--header "X-ENAME: @911253cf-885e-5a71-b0e4-c9df4cb6cd40" \
--header "Content-Type: application/json" \
--data @-
```

**With Bearer Token (Should WORK):**
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

### After Fix (SECURE):
- All operations without valid Bearer token OR X-ENAME header will return an error:
  ```json
  {
    "errors": [{
      "message": "Authentication required: Either provide a valid Bearer token in Authorization header or X-ENAME header"
    }]
  }
  ```
- Operations with valid eName will work (for backward compatibility)
- Operations with valid Bearer token will work (for platform integrations)

## Testing Checklist

- [ ] Test all queries without auth (should all fail)
- [ ] Test all queries with eName (should all work)
- [ ] Test all queries with Bearer token (should all work)
- [ ] Test all mutations without auth (should all fail)
- [ ] Test all mutations with eName (should all work)
- [ ] Test all mutations with Bearer token (should all work)
- [ ] Test with empty eName (should fail)
- [ ] Test with invalid Bearer token (should fail)

