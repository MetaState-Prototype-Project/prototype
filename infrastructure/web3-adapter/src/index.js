"use strict";
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (
                  !desc ||
                  ("get" in desc
                      ? !m.__esModule
                      : desc.writable || desc.configurable)
              ) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k];
                      },
                  };
              }
              Object.defineProperty(o, k2, desc);
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
          });
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, "default", {
                  enumerable: true,
                  value: v,
              });
          }
        : function (o, v) {
              o["default"] = v;
          });
var __importStar =
    (this && this.__importStar) ||
    (function () {
        var ownKeys = function (o) {
            ownKeys =
                Object.getOwnPropertyNames ||
                function (o) {
                    var ar = [];
                    for (var k in o)
                        if (Object.prototype.hasOwnProperty.call(o, k))
                            ar[ar.length] = k;
                    return ar;
                };
            return ownKeys(o);
        };
        return function (mod) {
            if (mod && mod.__esModule) return mod;
            var result = {};
            if (mod != null)
                for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                    if (k[i] !== "default") __createBinding(result, mod, k[i]);
            __setModuleDefault(result, mod);
            return result;
        };
    })();
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Web3Adapter = void 0;
const fs = __importStar(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("./db");
const evault_1 = require("./evault/evault");
const mapper_1 = require("./mapper/mapper");
class Web3Adapter {
    constructor(config) {
        this.config = config;
        this.mapping = {};
        this.lockedIds = [];
        this.readPaths();
        this.mappingDb = new db_1.MappingDatabase(config.dbPath);
        this.evaultClient = new evault_1.EVaultClient(
            config.registryUrl,
            config.platform,
        );
        this.platform = config.platform;
    }
    async readPaths() {
        const allRawFiles = await fs.readdir(this.config.schemasPath);
        const mappingFiles = allRawFiles.filter((p) => p.endsWith(".json"));
        for (const mappingFile of mappingFiles) {
            const mappingFileContent = await fs.readFile(
                node_path_1.default.join(this.config.schemasPath, mappingFile),
            );
            const mappingParsed = JSON.parse(mappingFileContent.toString());
            this.mapping[mappingParsed.tableName] = mappingParsed;
        }
    }
    addToLockedIds(id) {
        this.lockedIds.push(id);
        console.log("Added", this.lockedIds);
        setTimeout(() => {
            this.lockedIds = this.lockedIds.filter((f) => f !== id);
        }, 15000);
    }
    async handleChange(props) {
        const { data, tableName, participants } = props;
        const existingGlobalId = await this.mappingDb.getGlobalId(data.id);
        console.log(this.mapping, tableName, this.mapping[tableName]);
        // If we already have a mapping, use that global ID
        if (existingGlobalId) {
            if (this.lockedIds.includes(existingGlobalId)) return;
            const global = await (0, mapper_1.toGlobal)({
                data,
                mapping: this.mapping[tableName],
                mappingStore: this.mappingDb,
            });
            this.evaultClient
                .updateMetaEnvelopeById(existingGlobalId, {
                    id: existingGlobalId,
                    w3id: global.ownerEvault,
                    data: global.data,
                    schemaId: this.mapping[tableName].schemaId,
                })
                .catch(() => console.error("failed to sync update"));
            return {
                id: existingGlobalId,
                w3id: global.ownerEvault,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            };
        }
        // For new entities, create a new global ID
        const global = await (0, mapper_1.toGlobal)({
            data,
            mapping: this.mapping[tableName],
            mappingStore: this.mappingDb,
        });
        let globalId;
        if (global.ownerEvault) {
            globalId = await this.evaultClient.storeMetaEnvelope({
                id: null,
                w3id: global.ownerEvault,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            });
            console.log("created new meta-env", globalId);
        } else {
            return;
        }
        // Store the mapping
        await this.mappingDb.storeMapping({
            localId: data.id,
            globalId,
        });
        // Handle references for other participants
        const otherEvaults = (participants ?? []).filter(
            (i) => i !== global.ownerEvault,
        );
        for (const evault of otherEvaults) {
            await this.evaultClient.storeReference(
                `${global.ownerEvault}/${globalId}`,
                evault,
            );
        }
        return {
            id: globalId,
            w3id: global.ownerEvault,
            data: global.data,
            schemaId: this.mapping[tableName].schemaId,
        };
    }
    async fromGlobal(props) {
        const { data, mapping } = props;
        const local = await (0, mapper_1.fromGlobal)({
            data,
            mapping,
            mappingStore: this.mappingDb,
        });
        return local;
    }
}
exports.Web3Adapter = Web3Adapter;
//# sourceMappingURL=index.js.map
