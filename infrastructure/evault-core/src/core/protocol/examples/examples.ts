export const exampleQueries = `
# Welcome to eVault GraphQL Playground!
# This GraphiQL is pre-loaded with real examples you can try instantly.
# 
# Each object is stored as a MetaEnvelope, which is a flat graph of Envelopes.
# You can issue credentials, store data, update specific fields, or search by 
# content.
#
# 👇 Scroll down and uncomment the examples you want to run. Let's go 🚀

################################################################################
# ✅ 1. Store a SocialMediaPost
################################################################################

# mutation {
#   storeMetaEnvelope(input: {
#     ontology: "SocialMediaPost",
#     payload: {
#       text: "gm world!",
#       image: "https://example.com/pic.jpg",
#       dateCreated: "2025-04-10T10:00:00Z",
#       userLikes: ["@user1", "@user2"]
#     },
#     acl: ["@d1fa5cb1-6178-534b-a096-59794d485f65"]  # Who can access this object
#   }) {
#     metaEnvelope {
#       id
#       ontology
#       parsed
#     }
#     envelopes {
#       id
#       ontology
#       value
#       valueType
#     }
#   }
# }

################################################################################
# 🔍 2. Retrieve a MetaEnvelope by ID
################################################################################

# query {
#   getMetaEnvelopeById(id: "YOUR_META_ENVELOPE_ID_HERE") {
#     id
#     ontology
#     parsed
#     envelopes {
#       id
#       ontology
#       value
#       valueType
#     }
#   }
# }

################################################################################
# 🔎 3. Search MetaEnvelopes by Ontology + Keyword
################################################################################

# query {
#   searchMetaEnvelopes(ontology: "SocialMediaPost", term: "gm") {
#     id
#     parsed
#     envelopes {
#       ontology
#       value
#     }
#   }
# }

################################################################################
# 📚 4. Find All MetaEnvelope IDs by Ontology
################################################################################

# query {
#   findMetaEnvelopesByOntology(ontology: "SocialMediaPost")
# }

################################################################################
# ✏️ 5. Update a Single Envelope's Value
################################################################################

# mutation {
#   updateEnvelopeValue(
#     envelopeId: "YOUR_ENVELOPE_ID_HERE",
#     newValue: "Updated value"
#   )
# }

################################################################################
# 🧼 6. Delete a MetaEnvelope (and all linked Envelopes)
################################################################################

# mutation {
#   deleteMetaEnvelope(id: "YOUR_META_ENVELOPE_ID_HERE")
# }

################################################################################
# 🔄 7. Update a MetaEnvelope by ID
################################################################################

# mutation {
#   updateMetaEnvelopeById(
#     id: "YOUR_META_ENVELOPE_ID_HERE",
#     input: {
#       ontology: "SocialMediaPost",
#       payload: {
#         text: "Updated post content",
#         image: "https://example.com/new-pic.jpg",
#         dateCreated: "2025-04-10T10:00:00Z",
#         userLikes: ["@user1", "@user2", "@user3"]
#       },
#       acl: ["@d1fa5cb1-6178-534b-a096-59794d485f65"]
#     }
#   ) {
#     metaEnvelope {
#       id
#       ontology
#       parsed
#     }
#     envelopes {
#       id
#       ontology
#       value
#       valueType
#     }
#   }
# }

################################################################################
# 📦 8. List All Envelopes in the System
################################################################################

# query {
#   getAllEnvelopes {
#     id
#     ontology
#     value
#     valueType
#   }
# }
`;
