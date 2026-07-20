import { describe, expect, it } from '@jest/globals';
import {
  VARIANT_B_PROMPT_VERSION,
  VARIANT_B_RESPONSE_JSON_SCHEMA,
  VARIANT_B_SCHEMA_VERSION,
} from '../variantBPrompt';
import { VARIANT_C_RESPONSE_JSON_SCHEMA } from '../variantCPrompt';

type JsonSchemaNode = {
  type?: string | readonly string[];
  additionalProperties?: boolean;
  enum?: readonly unknown[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  anyOf?: readonly JsonSchemaNode[];
  oneOf?: readonly JsonSchemaNode[];
  allOf?: readonly JsonSchemaNode[];
};

/**
 * Anthropic structured outputs require every object schema, including nullable object unions,
 * to close its properties explicitly. Traverse every schema composition location so a future
 * nested object cannot silently reintroduce the rejected request shape.
 */
function findMixedNullableEnumPaths(schema: JsonSchemaNode, path = '$'): string[] {
  const violations: string[] = [];
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.enum?.includes(null) && types.some((type) => type && type !== 'null'))
    violations.push(path);
  for (const [name, child] of Object.entries(schema.properties ?? {}))
    violations.push(...findMixedNullableEnumPaths(child, `${path}.properties.${name}`));
  if (schema.items) violations.push(...findMixedNullableEnumPaths(schema.items, `${path}.items`));
  for (const key of ['anyOf', 'oneOf', 'allOf'] as const)
    for (const [index, child] of (schema[key] ?? []).entries())
      violations.push(...findMixedNullableEnumPaths(child, `${path}.${key}[${index}]`));
  return violations;
}

function findOpenObjectSchemaPaths(schema: JsonSchemaNode, path = '$'): string[] {
  const violations: string[] = [];
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes('object') && schema.additionalProperties !== false) {
    violations.push(path);
  }

  for (const [propertyName, propertySchema] of Object.entries(schema.properties ?? {})) {
    violations.push(
      ...findOpenObjectSchemaPaths(propertySchema, `${path}.properties.${propertyName}`),
    );
  }
  if (schema.items) violations.push(...findOpenObjectSchemaPaths(schema.items, `${path}.items`));
  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    for (const [index, branch] of (schema[keyword] ?? []).entries()) {
      violations.push(...findOpenObjectSchemaPaths(branch, `${path}.${keyword}[${index}]`));
    }
  }
  return violations;
}

describe('Variant B/C provider-facing JSON-schema contract', () => {
  it.each([
    ['Variant B', VARIANT_B_RESPONSE_JSON_SCHEMA],
    ['Variant C', VARIANT_C_RESPONSE_JSON_SCHEMA],
  ])('%s closes every nested object schema for Anthropic structured output', (_variant, schema) => {
    expect(findOpenObjectSchemaPaths(schema)).toEqual([]);
  });

  it('reports the complete path for a nested object-schema violation', () => {
    const schema: JsonSchemaNode = {
      type: 'object',
      additionalProperties: false,
      properties: {
        response: {
          anyOf: [
            {
              type: 'array',
              items: {
                type: 'object',
                properties: { nested: { type: 'object', properties: {} } },
              },
            },
          ],
        },
      },
    };

    expect(findOpenObjectSchemaPaths(schema)).toEqual([
      '$.properties.response.anyOf[0].items',
      '$.properties.response.anyOf[0].items.properties.nested',
    ]);
  });

  it.each([
    ['Variant B', VARIANT_B_RESPONSE_JSON_SCHEMA],
    ['Variant C', VARIANT_C_RESPONSE_JSON_SCHEMA],
  ])('%s has no mixed nullable enum nodes', (_variant, schema) => {
    expect(findMixedNullableEnumPaths(schema)).toEqual([]);
  });

  it('represents the quantity unit nullable enum as separate anyOf branches', () => {
    const unit =
      VARIANT_B_RESPONSE_JSON_SCHEMA.properties.components.items.properties.quantity.properties
        .unit;
    expect(unit).toEqual({
      anyOf: [{ type: 'string', enum: ['g', 'ml', 'piece', 'portion'] }, { type: 'null' }],
    });
  });

  it('versions the provider-facing Variant B schema without changing its prompt version', () => {
    expect(VARIANT_B_SCHEMA_VERSION).toBe('variant-b-schema-v3');
    expect(VARIANT_B_PROMPT_VERSION).toBe('variant-b-prompt-v1');
  });

  it('regresses the exact Variant B nested object structure rejected during the live attempt', () => {
    const component = VARIANT_B_RESPONSE_JSON_SCHEMA.properties.components.items;
    const quantity = component.properties.quantity;
    const totals = VARIANT_B_RESPONSE_JSON_SCHEMA.properties.totals;
    const clarification = VARIANT_B_RESPONSE_JSON_SCHEMA.properties.clarification;

    expect(component.additionalProperties).toBe(false);
    expect(quantity.additionalProperties).toBe(false);
    expect(totals.additionalProperties).toBe(false);
    expect(clarification.additionalProperties).toBe(false);
  });
});
