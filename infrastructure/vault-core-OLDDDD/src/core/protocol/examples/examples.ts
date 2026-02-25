export const exampleQueries = `
# Welcome to eVault GraphQL Playground!
# This GraphiQL is pre-loaded with real examples you can try instantly.
# 
# Each object is stored as a MetaEnvelope, which is a flat graph of Envelopes.
# You can create, query, update, and delete data with pagination and filtering.
#
# IMPORTANT: All operations require the X-ENAME header to be set.
# Set it in the HTTP Headers panel below (e.g., {"X-ENAME": "@your-w3id"})
#
# Scroll down and uncomment the examples you want to run!

################################################################################
# 1. Create a MetaEnvelope (e.g., a SocialMediaPost)
################################################################################

# mutation {
#   createMetaEnvelope(input: {
#     ontology: "SocialMediaPost",
#     payload: {
#       text: "gm world!",
#       image: "https://example.com/pic.jpg",
#       dateCreated: "2025-04-10T10:00:00Z",
#       userLikes: ["@user1", "@user2"]
#     },
#     acl: ["*"]  # Who can access this object ("*" = public)
#   }) {
#     metaEnvelope {
#       id
#       ontology
#       parsed
#       envelopes {
#         id
#         fieldKey
#         value
#         valueType
#       }
#     }
#     errors {
#       field
#       message
#       code
#     }
#   }
# }

################################################################################
# 2. Retrieve a Single MetaEnvelope by ID
################################################################################

# query {
#   metaEnvelope(id: "YOUR_META_ENVELOPE_ID_HERE") {
#     id
#     ontology
#     parsed
#     envelopes {
#       id
#       fieldKey
#       value
#       valueType
#     }
#   }
# }

################################################################################
# 3. Query MetaEnvelopes with Pagination
################################################################################

# query {
#   metaEnvelopes(
#     filter: {
#       ontologyId: "SocialMediaPost"
#     }
#     first: 10
#   ) {
#     edges {
#       cursor
#       node {
#         id
#         ontology
#         parsed
#       }
#     }
#     pageInfo {
#       hasNextPage
#       hasPreviousPage
#       startCursor
#       endCursor
#     }
#     totalCount
#   }
# }

################################################################################
# 4. Search MetaEnvelopes with Filtering
################################################################################

# query {
#   metaEnvelopes(
#     filter: {
#       ontologyId: "SocialMediaPost"
#       search: {
#         term: "gm"
#         caseSensitive: false
#         mode: CONTAINS
#       }
#     }
#     first: 10
#   ) {
#     edges {
#       node {
#         id
#         parsed
#       }
#     }
#     totalCount
#   }
# }

################################################################################
# 5. Update a MetaEnvelope
################################################################################

# mutation {
#   updateMetaEnvelope(
#     id: "YOUR_META_ENVELOPE_ID_HERE",
#     input: {
#       ontology: "SocialMediaPost",
#       payload: {
#         text: "Updated post content!",
#         image: "https://example.com/new-pic.jpg",
#         dateCreated: "2025-04-10T10:00:00Z",
#         userLikes: ["@user1", "@user2", "@user3"]
#       },
#       acl: ["*"]
#     }
#   ) {
#     metaEnvelope {
#       id
#       ontology
#       parsed
#       envelopes {
#         fieldKey
#         value
#       }
#     }
#     errors {
#       message
#       code
#     }
#   }
# }

################################################################################
# 6. Delete a MetaEnvelope
################################################################################

# mutation {
#   removeMetaEnvelope(id: "YOUR_META_ENVELOPE_ID_HERE") {
#     deletedId
#     success
#     errors {
#       message
#       code
#     }
#   }
# }

################################################################################
# 7. Paginate Through Results (using cursor)
################################################################################

# query {
#   metaEnvelopes(
#     filter: { ontologyId: "SocialMediaPost" }
#     first: 5
#     after: "CURSOR_FROM_PREVIOUS_RESPONSE"
#   ) {
#     edges {
#       cursor
#       node {
#         id
#         parsed
#       }
#     }
#     pageInfo {
#       hasNextPage
#       endCursor
#     }
#   }
# }

################################################################################
# LEGACY API (for backward compatibility)
# These endpoints still work but prefer the new API above
################################################################################

# # Legacy: Store a MetaEnvelope
# mutation {
#   storeMetaEnvelope(input: {
#     ontology: "SocialMediaPost",
#     payload: { text: "Hello!" },
#     acl: ["*"]
#   }) {
#     metaEnvelope { id }
#   }
# }

# # Legacy: Get by ID
# query {
#   getMetaEnvelopeById(id: "...") { id parsed }
# }

# # Legacy: Find by ontology (no pagination)
# query {
#   findMetaEnvelopesByOntology(ontology: "SocialMediaPost") { id }
# }

# # Legacy: Search (no pagination)
# query {
#   searchMetaEnvelopes(ontology: "SocialMediaPost", term: "hello") { id }
# }

# # Legacy: Delete (returns boolean)
# mutation {
#   deleteMetaEnvelope(id: "...")
# }
`;
