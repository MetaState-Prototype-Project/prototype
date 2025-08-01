import type { IMapperResponse, IMappingConversionOptions } from "./mapper.types";
export declare function getValueByPath(obj: Record<string, any>, path: string): any;
export declare function fromGlobal({ data, mapping, mappingStore, }: IMappingConversionOptions): Promise<Omit<IMapperResponse, "ownerEvault">>;
export declare function toGlobal({ data, mapping, mappingStore, }: IMappingConversionOptions): Promise<IMapperResponse>;
//# sourceMappingURL=mapper.d.ts.map