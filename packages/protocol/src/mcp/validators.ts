import { z, type ZodType } from 'zod';
import canonicalMcpContract from '../../../../doc/03-User-Interface/MCP-Contract.schema.json' with {
  type: 'json'
};
import { MCP_TOOL_NAMES, type McpToolName } from './tool-catalog.js';

type JsonSchema = boolean | Readonly<Record<string, unknown>>;
type JsonPath = readonly (string | number)[];

interface ValidationIssue {
  readonly path: JsonPath;
  readonly message: string;
}

const schemaBundle = canonicalMcpContract as Readonly<Record<string, unknown>> & {
  readonly $defs: Readonly<Record<string, JsonSchema>>;
};

export const MCP_CONTRACT_SCHEMA_BUNDLE: Readonly<Record<string, unknown>> = schemaBundle;

function collectReferencedDefinitions(schema: JsonSchema, collected: Map<string, JsonSchema>): void {
  if (typeof schema === 'boolean') return;
  if (typeof schema.$ref === 'string' && schema.$ref.startsWith('#/$defs/')) {
    const name = schema.$ref.slice('#/$defs/'.length).replaceAll('~1', '/').replaceAll('~0', '~');
    if (!collected.has(name)) {
      const definition = resolveRef(schema.$ref);
      collected.set(name, definition);
      collectReferencedDefinitions(definition, collected);
    }
  }
  for (const [key, child] of Object.entries(schema)) {
    if (key === '$defs') continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (isRecord(item) || typeof item === 'boolean') collectReferencedDefinitions(item, collected);
      }
    } else if (isRecord(child) || typeof child === 'boolean') {
      collectReferencedDefinitions(child, collected);
    }
  }
}

function publicRootSchema(rootName: string): Readonly<Record<string, unknown>> {
  const root = resolveRef(`#/$defs/${rootName}`);
  if (typeof root === 'boolean') return { $schema: schemaBundle.$schema, const: root };
  const definitions = new Map<string, JsonSchema>();
  collectReferencedDefinitions(root, definitions);
  return {
    $schema: schemaBundle.$schema,
    ...root,
    $defs: Object.fromEntries(definitions)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]))
    );
  }
  return false;
}

function resolveRef(reference: string): JsonSchema {
  const prefix = '#/$defs/';
  if (!reference.startsWith(prefix)) throw new Error(`Only local MCP contract references are supported: ${reference}`);
  const name = reference.slice(prefix.length).replaceAll('~1', '/').replaceAll('~0', '~');
  const resolved = schemaBundle.$defs[name];
  if (resolved === undefined) throw new Error(`Unknown MCP contract definition: ${reference}`);
  return resolved;
}

function matchesType(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'null': return value === null;
    case 'boolean': return typeof value === 'boolean';
    case 'object': return isRecord(value);
    case 'array': return Array.isArray(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
    case 'string': return typeof value === 'string';
    default: throw new Error(`Unsupported JSON Schema type in canonical MCP contract: ${expected}`);
  }
}

function isValidDateTime(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function validateSchema(schema: JsonSchema, value: unknown, path: JsonPath, issues: ValidationIssue[]): void {
  if (schema === true) return;
  if (schema === false) {
    issues.push({ path, message: 'Value is forbidden by the canonical schema.' });
    return;
  }

  if (typeof schema.$ref === 'string') validateSchema(resolveRef(schema.$ref), value, path, issues);
  if (Object.hasOwn(schema, 'const') && !deepEqual(value, schema.const)) {
    issues.push({ path, message: `Expected the canonical constant ${JSON.stringify(schema.const)}.` });
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    issues.push({ path, message: 'Value is not one of the canonical enum values.' });
  }

  if (typeof schema.type === 'string' && !matchesType(value, schema.type)) {
    issues.push({ path, message: `Expected ${schema.type}.` });
    return;
  }
  if (
    Array.isArray(schema.type) &&
    !schema.type.some((candidate) => typeof candidate === 'string' && matchesType(value, candidate))
  ) {
    issues.push({ path, message: `Expected one of: ${schema.type.join(', ')}.` });
    return;
  }

  if (Array.isArray(schema.allOf)) {
    for (const branch of schema.allOf) validateSchema(branch as JsonSchema, value, path, issues);
  }
  if (Array.isArray(schema.anyOf)) {
    const matches = schema.anyOf.filter((branch) => branchMatches(branch as JsonSchema, value, path)).length;
    if (matches === 0) issues.push({ path, message: 'Value does not match any allowed canonical branch.' });
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((branch) => branchMatches(branch as JsonSchema, value, path)).length;
    if (matches !== 1) issues.push({ path, message: `Value must match exactly one canonical branch; matched ${matches}.` });
  }
  if (schema.not !== undefined && branchMatches(schema.not as JsonSchema, value, path)) {
    issues.push({ path, message: 'Value matches a forbidden canonical branch.' });
  }
  if (schema.if !== undefined) {
    const selected = branchMatches(schema.if as JsonSchema, value, path) ? schema.then : schema.else;
    if (selected !== undefined) validateSchema(selected as JsonSchema, value, path, issues);
  }

  if (isRecord(value)) validateObjectKeywords(schema, value, path, issues);
  if (Array.isArray(value)) validateArrayKeywords(schema, value, path, issues);
  if (typeof value === 'string') validateStringKeywords(schema, value, path, issues);
  if (typeof value === 'number' && Number.isFinite(value)) validateNumberKeywords(schema, value, path, issues);
}

function branchMatches(schema: JsonSchema, value: unknown, path: JsonPath): boolean {
  const branchIssues: ValidationIssue[] = [];
  validateSchema(schema, value, path, branchIssues);
  return branchIssues.length === 0;
}

function validateObjectKeywords(
  schema: Readonly<Record<string, unknown>>,
  value: Record<string, unknown>,
  path: JsonPath,
  issues: ValidationIssue[]
): void {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (typeof key === 'string' && !Object.hasOwn(value, key)) {
      issues.push({ path: [...path, key], message: 'Required property is missing.' });
    }
  }
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, key)) validateSchema(propertySchema as JsonSchema, value[key], [...path, key], issues);
  }

  for (const [key, propertyValue] of Object.entries(value)) {
    if (Object.hasOwn(properties, key)) continue;
    if (schema.additionalProperties === false) {
      issues.push({ path: [...path, key], message: 'Unknown property is not allowed.' });
    } else if (isRecord(schema.additionalProperties) || typeof schema.additionalProperties === 'boolean') {
      validateSchema(schema.additionalProperties as JsonSchema, propertyValue, [...path, key], issues);
    }
  }

  if (typeof schema.minProperties === 'number' && Object.keys(value).length < schema.minProperties) {
    issues.push({ path, message: `Expected at least ${schema.minProperties} properties.` });
  }
  if (typeof schema.maxProperties === 'number' && Object.keys(value).length > schema.maxProperties) {
    issues.push({ path, message: `Expected at most ${schema.maxProperties} properties.` });
  }
}

function validateArrayKeywords(
  schema: Readonly<Record<string, unknown>>,
  value: readonly unknown[],
  path: JsonPath,
  issues: ValidationIssue[]
): void {
  if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
    issues.push({ path, message: `Expected at least ${schema.minItems} items.` });
  }
  if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
    issues.push({ path, message: `Expected at most ${schema.maxItems} items.` });
  }
  if (schema.uniqueItems === true) {
    for (let index = 0; index < value.length; index += 1) {
      if (value.slice(0, index).some((candidate) => deepEqual(candidate, value[index]))) {
        issues.push({ path: [...path, index], message: 'Array items must be unique.' });
      }
    }
  }

  const prefixItems = Array.isArray(schema.prefixItems) ? schema.prefixItems : [];
  for (const [index, itemSchema] of prefixItems.entries()) {
    if (index < value.length) validateSchema(itemSchema as JsonSchema, value[index], [...path, index], issues);
  }
  if (schema.items !== undefined) {
    for (let index = prefixItems.length; index < value.length; index += 1) {
      validateSchema(schema.items as JsonSchema, value[index], [...path, index], issues);
    }
  }

  if (schema.contains !== undefined) {
    const count = value.filter((item, index) => branchMatches(schema.contains as JsonSchema, item, [...path, index])).length;
    const minimum = typeof schema.minContains === 'number' ? schema.minContains : 1;
    const maximum = typeof schema.maxContains === 'number' ? schema.maxContains : Number.POSITIVE_INFINITY;
    if (count < minimum || count > maximum) {
      issues.push({ path, message: `Expected ${minimum} to ${maximum} matching contained items; found ${count}.` });
    }
  }
}

function validateStringKeywords(
  schema: Readonly<Record<string, unknown>>,
  value: string,
  path: JsonPath,
  issues: ValidationIssue[]
): void {
  const length = [...value].length;
  if (typeof schema.minLength === 'number' && length < schema.minLength) {
    issues.push({ path, message: `Expected at least ${schema.minLength} characters.` });
  }
  if (typeof schema.maxLength === 'number' && length > schema.maxLength) {
    issues.push({ path, message: `Expected at most ${schema.maxLength} characters.` });
  }
  if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
    issues.push({ path, message: `Value does not match ${schema.pattern}.` });
  }
  if (schema.format === 'date-time' && !isValidDateTime(value)) {
    issues.push({ path, message: 'Expected an RFC 3339 date-time.' });
  }
}

function validateNumberKeywords(
  schema: Readonly<Record<string, unknown>>,
  value: number,
  path: JsonPath,
  issues: ValidationIssue[]
): void {
  if (typeof schema.minimum === 'number' && value < schema.minimum) {
    issues.push({ path, message: `Expected a value greater than or equal to ${schema.minimum}.` });
  }
  if (typeof schema.maximum === 'number' && value > schema.maximum) {
    issues.push({ path, message: `Expected a value less than or equal to ${schema.maximum}.` });
  }
  if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
    issues.push({ path, message: `Expected a value greater than ${schema.exclusiveMinimum}.` });
  }
  if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
    issues.push({ path, message: `Expected a value less than ${schema.exclusiveMaximum}.` });
  }
  if (typeof schema.multipleOf === 'number' && value / schema.multipleOf % 1 !== 0) {
    issues.push({ path, message: `Expected a multiple of ${schema.multipleOf}.` });
  }
}

function compileRoot(rootName: string): ZodType<unknown> {
  const root = resolveRef(`#/$defs/${rootName}`);
  return z.unknown().superRefine((value, context) => {
    const issues: ValidationIssue[] = [];
    validateSchema(root, value, [], issues);
    for (const issue of issues) context.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
  });
}

function compileOutputRoot(rootName: string): ZodType<unknown> {
  return compileRoot(rootName).superRefine((value, context) => {
    if (!isRecord(value) || !isRecord(value.facts) || !isRecord(value.facts.ticket)) return;
    const requestRef = value.facts.ticket.request_ref;
    if (typeof requestRef !== 'string' || !Array.isArray(value.available_actions)) return;
    for (const [index, action] of value.available_actions.entries()) {
      if (!isRecord(action) || action.tool !== 'get_browser_request' || !isRecord(action.arguments)) continue;
      if (action.arguments.request_ref !== requestRef) {
        context.addIssue({
          code: 'custom',
          path: ['available_actions', index, 'arguments', 'request_ref'],
          message: 'The polling action must repeat the returned ticket request_ref.'
        });
      }
    }
  });
}

export const mcpToolInputSchemas: Readonly<Record<McpToolName, ZodType<unknown>>> = Object.freeze(
  Object.fromEntries(MCP_TOOL_NAMES.map((name) => [name, compileRoot(`${name}_input`)])) as Record<McpToolName, ZodType<unknown>>
);

export const mcpToolOutputSchemas: Readonly<Record<McpToolName, ZodType<unknown>>> = Object.freeze(
  Object.fromEntries(MCP_TOOL_NAMES.map((name) => [name, compileOutputRoot(`${name}_output`)])) as Record<McpToolName, ZodType<unknown>>
);

export const mcpToolInputJsonSchemas: Readonly<Record<McpToolName, Readonly<Record<string, unknown>>>> =
  Object.freeze(
    Object.fromEntries(MCP_TOOL_NAMES.map((name) => [name, publicRootSchema(`${name}_input`)])) as Record<
      McpToolName,
      Readonly<Record<string, unknown>>
    >
  );

export const mcpToolOutputJsonSchemas: Readonly<Record<McpToolName, Readonly<Record<string, unknown>>>> =
  Object.freeze(
    Object.fromEntries(MCP_TOOL_NAMES.map((name) => [name, publicRootSchema(`${name}_output`)])) as Record<
      McpToolName,
      Readonly<Record<string, unknown>>
    >
  );

export function getMcpToolSchemas(tool: McpToolName): { readonly input: ZodType<unknown>; readonly output: ZodType<unknown> } {
  return { input: mcpToolInputSchemas[tool], output: mcpToolOutputSchemas[tool] };
}

export function getMcpToolJsonSchemas(tool: McpToolName): {
  readonly input: Readonly<Record<string, unknown>>;
  readonly output: Readonly<Record<string, unknown>>;
} {
  return { input: mcpToolInputJsonSchemas[tool], output: mcpToolOutputJsonSchemas[tool] };
}

export function parseMcpToolInput(tool: McpToolName, raw: unknown): unknown {
  return mcpToolInputSchemas[tool].parse(raw);
}
export function safeParseMcpToolInput(tool: McpToolName, raw: unknown) {
  return mcpToolInputSchemas[tool].safeParse(raw);
}
export function parseMcpToolOutput(tool: McpToolName, raw: unknown): unknown {
  return mcpToolOutputSchemas[tool].parse(raw);
}
export function safeParseMcpToolOutput(tool: McpToolName, raw: unknown) {
  return mcpToolOutputSchemas[tool].safeParse(raw);
}
