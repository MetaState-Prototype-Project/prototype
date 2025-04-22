export type FieldMapping = {
  sourceField: string;
  targetField: string;
  transform?: (value: any) => any;
};

export class Web3Adapter {
  private mappings: Map<string, FieldMapping[]>;

  constructor() {
    this.mappings = new Map();
  }

  public registerMapping(platform: string, mappings: FieldMapping[]): void {
    this.mappings.set(platform, mappings);
  }

  public toUniversal(
    platform: string,
    data: Record<string, any>
  ): Record<string, any> {
    const mappings = this.mappings.get(platform);
    if (!mappings) {
      throw new Error(`No mappings found for platform: ${platform}`);
    }

    const result: Record<string, any> = {};
    for (const mapping of mappings) {
      if (data[mapping.sourceField] !== undefined) {
        const value = mapping.transform
          ? mapping.transform(data[mapping.sourceField])
          : data[mapping.sourceField];
        result[mapping.targetField] = value;
      }
    }
    return result;
  }

  public fromUniversal(
    platform: string,
    data: Record<string, any>
  ): Record<string, any> {
    const mappings = this.mappings.get(platform);
    if (!mappings) {
      throw new Error(`No mappings found for platform: ${platform}`);
    }

    const result: Record<string, any> = {};
    for (const mapping of mappings) {
      if (data[mapping.targetField] !== undefined) {
        const value = mapping.transform
          ? mapping.transform(data[mapping.targetField])
          : data[mapping.targetField];
        result[mapping.sourceField] = value;
      }
    }
    return result;
  }
}
