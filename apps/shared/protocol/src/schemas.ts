import { z } from 'zod';

export {
  getMcpToolJsonSchemas,
  getMcpToolSchemas,
  mcpToolInputJsonSchemas,
  mcpToolInputSchemas,
  mcpToolOutputJsonSchemas,
  mcpToolOutputSchemas,
  parseMcpToolInput,
  parseMcpToolOutput,
  safeParseMcpToolInput,
  safeParseMcpToolOutput
} from './mcp/validators.js';

export const TargetAliasSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/i);

export const BindingRefSchema = z
  .string()
  .min(35)
  .max(128)
  .regex(/^br_[A-Za-z0-9_-]+$/);

export const ListTargetsInputSchema = z.strictObject({});
export const GetMyBindingInputSchema = z.strictObject({});
export const GetTargetInputSchema = z.strictObject({ bindingRef: BindingRefSchema });

export const AcquireSessionInputSchema = z.strictObject({
  bindingRef: BindingRefSchema,
  waitMs: z.number().int().min(0).max(120_000).default(0),
  ttlMs: z.number().int().min(5_000).max(300_000).default(60_000)
});

export const ReleaseSessionInputSchema = z.strictObject({
  bindingRef: BindingRefSchema,
  sessionHandle: z.string().min(32).max(256)
});

export const DispatchInputSchema = z.strictObject({
  runId: z.string().min(8).max(128).optional(),
  bindingRef: BindingRefSchema,
  sessionHandle: z.string().min(32).max(256).optional(),
  operation: z.string().min(1).max(64),
  parameters: z.unknown().default({}),
  idempotencyClass: z.enum(['read', 'idempotent-write', 'non-idempotent']).default('read'),
  idempotencyKey: z.string().min(8).max(128).optional(),
  waitMs: z.number().int().min(0).max(120_000).default(0),
  deadlineMs: z.number().int().min(100).max(300_000).default(30_000)
});

export const GetCommandInputSchema = z.strictObject({
  bindingRef: BindingRefSchema,
  commandId: z.string().uuid()
});

export const PairTargetInputSchema = z.strictObject({
  alias: TargetAliasSchema,
  expiresInMs: z.number().int().min(30_000).max(600_000).default(300_000)
});

export const RenameTargetInputSchema = z.strictObject({
  alias: TargetAliasSchema,
  newAlias: TargetAliasSchema
});

export const RevokeTargetInputSchema = z.strictObject({ alias: TargetAliasSchema });
export const BindAgentInputSchema = z.strictObject({
  principalId: z.string().uuid(),
  alias: TargetAliasSchema
});
export const UnbindAgentInputSchema = z.strictObject({ principalId: z.string().uuid() });
export const ListBindingsInputSchema = z.strictObject({});
export const BrokerHealthInputSchema = z.strictObject({});

export const OperationParametersSchemas = {
  list_tabs: z.strictObject({}),
  get_active_tab: z.strictObject({}),
  open_url: z.strictObject({ url: z.string().url().max(2048), active: z.boolean().default(true) }),
  activate_tab: z.strictObject({ tabId: z.number().int().nonnegative() }),
  navigate: z.strictObject({ tabId: z.number().int().nonnegative().optional(), url: z.string().url().max(2048) }),
  snapshot: z.strictObject({ tabId: z.number().int().nonnegative().optional(), maxChars: z.number().int().min(128).max(50_000).default(10_000) })
} as const;

export const allowedOperations = Object.freeze(Object.keys(OperationParametersSchemas));

export function validateOperation(operation: string, parameters: unknown): unknown {
  const schema = OperationParametersSchemas[operation as keyof typeof OperationParametersSchemas];
  if (!schema) throw new Error(`Unsupported operation: ${operation}`);
  return schema.parse(parameters);
}
