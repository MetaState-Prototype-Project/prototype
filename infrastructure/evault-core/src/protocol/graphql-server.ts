import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "http";
import { typeDefs } from "./typedefs";
import { DbService } from "../db/db.service";
import { renderVoyagerPage } from "graphql-voyager/middleware";

export class GraphQLServer {
    private db: DbService;

    constructor(db: DbService) {
        this.db = db;
        this.instantiateServer();
    }

    private instantiateServer() {
        const resolvers = {
            JSON: require("graphql-type-json"),

            Query: {
                getMetaEnvelopeById: (_: any, { id }: { id: string }) =>
                    this.db.findMetaEnvelopeById(id),
                findMetaEnvelopesByOntology: (
                    _: any,
                    { ontology }: { ontology: string },
                ) => this.db.findMetaEnvelopesByOntology(ontology),
                searchMetaEnvelopes: (
                    _: any,
                    { ontology, term }: { ontology: string; term: string },
                ) => this.db.findMetaEnvelopesBySearchTerm(ontology, term),
                getAllEnvelopes: () => this.db.getAllEnvelopes(),
            },

            Mutation: {
                storeMetaEnvelope: async (
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
                    return await this.db.storeMetaEnvelope(
                        {
                            ontology: input.ontology,
                            payload: input.payload,
                            acl: input.acl,
                        },
                        input.acl,
                    );
                },
                deleteMetaEnvelope: async (_: any, { id }: { id: string }) => {
                    await this.db.deleteMetaEnvelope(id);
                    return true;
                },
                updateEnvelopeValue: async (
                    _: any,
                    {
                        envelopeId,
                        newValue,
                    }: { envelopeId: string; newValue: any },
                ) => {
                    await this.db.updateEnvelopeValue(envelopeId, newValue);
                    return true;
                },
            },
        };

        const schema = createSchema({ typeDefs, resolvers });
        const yoga = createYoga({ schema });
        const server = createServer((req, res) => {
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

        server.listen(4000, () => {
            console.log("🚀 GraphQL at http://localhost:4000/graphql");
            console.log("🛰️ Voyager at http://localhost:4000/voyager");
        });
    }
}
