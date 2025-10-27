import {
  BaseFilterTranslator,
  type VectorFilter,
} from "../common/filter";

/**
 * Cloudflare AI Search Filter
 * Maps to metadata filters supported by Cloudflare AI Search API
 */
export type CloudflareVectorFilter = Record<string, string | number | boolean | string[]>;

/**
 * Filter translator for Cloudflare AI Search
 * Converts AgentSet VectorFilter to Cloudflare metadata filter format
 */
export class CloudflareFilterTranslator extends BaseFilterTranslator<
  VectorFilter,
  CloudflareVectorFilter | null
> {
  translate(filter: VectorFilter): CloudflareVectorFilter | null {
    if (!filter) return null;

    // Cloudflare AI Search uses simple key-value metadata filters
    // We only support basic field equality for now
    const result: CloudflareVectorFilter = {};

    for (const [key, value] of Object.entries(filter)) {
      // Skip operators for now - Cloudflare uses simple equality matching
      if (this.isOperator(key)) {
        console.warn(`Cloudflare AI Search: Operator ${key} not fully supported, using simple equality matching`);
        continue;
      }

      // Only support primitive values
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
        result[key] = value as string[];
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested operator conditions - extract $eq values
        const operatorValue = value as Record<string, any>;
        if ('$eq' in operatorValue) {
          const eqValue = operatorValue.$eq;
          if (typeof eqValue === 'string' || typeof eqValue === 'number' || typeof eqValue === 'boolean') {
            result[key] = eqValue;
          }
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }
}
