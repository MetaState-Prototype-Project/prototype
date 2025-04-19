import { createSchema, createYoga, YogaInitialContext } from "graphql-yoga";
import { createServer, Server } from "http";
import { typeDefs } from "./typedefs";
import { renderVoyagerPage } from "graphql-voyager/middleware";
import { getJWTHeader } from "w3id";
import { DbService } from "../db/db.service";
import { VaultAccessGuard, VaultContext } from "./vault-access-guard";
import { GraphQLSchema } from "graphql";
import { exampleQueries } from "./examples/examples";

export class GraphQLServer {
    private db: DbService;
    private accessGuard: VaultAccessGuard;
    private schema: GraphQLSchema = createSchema<VaultContext>({
        typeDefs,
        resolvers: {},
    });
    server?: Server;

    constructor(db: DbService) {
        this.db = db;
        this.accessGuard = new VaultAccessGuard(db);
        this.instantiateServer();
    }

    public getSchema(): GraphQLSchema {
        return this.schema;
    }

    private instantiateServer() {
        const resolvers = {
            JSON: require("graphql-type-json"),

            Query: {
                getMetaEnvelopeById: this.accessGuard.middleware(
                    (_: any, { id }: { id: string }) => {
                        return this.db.findMetaEnvelopeById(id);
                    },
                ),
                findMetaEnvelopesByOntology: this.accessGuard.middleware(
                    (_: any, { ontology }: { ontology: string }) => {
                        return this.db.findMetaEnvelopesByOntology(ontology);
                    },
                ),
                searchMetaEnvelopes: this.accessGuard.middleware(
                    (
                        _: any,
                        { ontology, term }: { ontology: string; term: string },
                    ) => {
                        return this.db.findMetaEnvelopesBySearchTerm(
                            ontology,
                            term,
                        );
                    },
                ),
                getAllEnvelopes: this.accessGuard.middleware(() => {
                    return this.db.getAllEnvelopes();
                }),
            },

            Mutation: {
                storeMetaEnvelope: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            input,
                        }: {
                            input: {
                                ontology: string;
                                payload: any;
                                acl: string[];
                            };
                        },
                    ) => {
                        const result = await this.db.storeMetaEnvelope(
                            {
                                ontology: input.ontology,
                                payload: input.payload,
                                acl: input.acl,
                            },
                            input.acl,
                        );
                        return result;
                    },
                ),
                deleteMetaEnvelope: this.accessGuard.middleware(
                    async (_: any, { id }: { id: string }) => {
                        await this.db.deleteMetaEnvelope(id);
                        return true;
                    },
                ),
                updateEnvelopeValue: this.accessGuard.middleware(
                    async (
                        _: any,
                        {
                            envelopeId,
                            newValue,
                        }: { envelopeId: string; newValue: any },
                    ) => {
                        await this.db.updateEnvelopeValue(envelopeId, newValue);
                        return true;
                    },
                ),
            },
        };

        this.schema = createSchema<VaultContext>({
            typeDefs,
            resolvers,
        });

        const yoga = createYoga({
            schema: this.schema,
            graphiql: {
                defaultQuery: exampleQueries,
            },
            context: async ({ request }) => {
                const authHeader = request.headers.get("authorization") ?? "";
                const token = authHeader.replace("Bearer ", "");

                if (token) {
                    const id = getJWTHeader(token).kid?.split("#")[0];
                    return {
                        currentUser: id ?? null,
                    };
                }

                return {
                    currentUser: null,
                };
            },
        });

        this.server = createServer((req, res) => {
            if (req.url === "/voyager") {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(
                    renderVoyagerPage({
                        endpointUrl: "/graphql",
                    }),
                );
            } else {
                yoga(req, res);
            }
        });
    }
}
