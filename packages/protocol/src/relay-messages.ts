import { z } from 'zod';

export {
  MAX_RELAY_V2_ENVELOPE_BYTES,
  RELAY_PROTOCOL_V2,
  RELAY_V2_MESSAGE_TYPES,
  RelayProtocolNegotiationError,
  RelayV2EnvelopeTooLargeError,
  RelayV2AttemptIdSchema,
  RelayV2EndpointIdentitySchema,
  RelayV2TabGroupInventorySchema,
  RelayV2TabGroupLocatorSchema,
  RelayV2TabInventorySchema,
  RelayV2TabLocatorSchema,
  RelayV2WindowInventorySchema,
  RelayV2WindowLocatorSchema,
  createRelayV2Envelope,
  negotiateRelayProtocol,
  parseRelayV2Envelope,
  relayV2PayloadSchemas,
  type RelayV2Envelope,
  type RelayV2MessageType,
  type RelayV2PayloadByType
} from './relay/v2-messages.js';

/** @deprecated Relay v1 remains temporarily available for migration tests only. */
export const RELAY_PROTOCOL_VERSION = 1 as const;

const JwkSchema = z.strictObject({
  kty: z.string(),
  crv: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional()
});

const BaseEnvelopeSchema = z.strictObject({
  protocolVersion: z.literal(RELAY_PROTOCOL_VERSION),
  messageId: z.string().uuid(),
  sentAt: z.string().datetime(),
  type: z.string(),
  payload: z.unknown()
});

const MessageSchemas = {
  HELLO: z.strictObject({
    targetId: z.string().uuid().optional(),
    publicKeyJwk: JwkSchema,
    pairingCode: z.string().length(8).optional(),
    capabilities: z.array(z.string().min(1).max(64)).max(32),
    extensionVersion: z.string().min(1).max(32)
  }),
  CHALLENGE: z.strictObject({ nonce: z.string().min(32).max(256), connectionEpoch: z.number().int().positive() }),
  AUTH: z.strictObject({ targetId: z.string().uuid(), signature: z.string().min(32).max(4096), connectionEpoch: z.number().int().positive() }),
  PAIRED: z.strictObject({ targetId: z.string().uuid(), alias: z.string(), connectionEpoch: z.number().int().positive() }),
  READY: z.strictObject({ targetId: z.string().uuid(), alias: z.string(), connectionEpoch: z.number().int().positive() }),
  HEARTBEAT: z.strictObject({ targetId: z.string().uuid(), connectionEpoch: z.number().int().positive(), activeCommandId: z.string().uuid().nullable() }),
  COMMAND: z.strictObject({
    commandId: z.string().uuid(),
    operation: z.string().min(1).max(64),
    parameters: z.unknown(),
    deadlineAt: z.string().datetime(),
    fencingToken: z.number().int().nonnegative().optional()
  }),
  ACK: z.strictObject({ commandId: z.string().uuid(), connectionEpoch: z.number().int().positive() }),
  PROGRESS: z.strictObject({ commandId: z.string().uuid(), connectionEpoch: z.number().int().positive(), progress: z.number().min(0).max(1), message: z.string().max(500).optional() }),
  RESULT: z.strictObject({ commandId: z.string().uuid(), connectionEpoch: z.number().int().positive(), ok: z.boolean(), output: z.unknown().optional(), errorCode: z.string().max(128).optional(), errorMessage: z.string().max(1000).optional() }),
  ERROR: z.strictObject({ code: z.string().max(128), message: z.string().max(1000), commandId: z.string().uuid().optional() })
} as const;

export type RelayMessageType = keyof typeof MessageSchemas;

export interface RelayEnvelope<T = unknown> {
  protocolVersion: typeof RELAY_PROTOCOL_VERSION;
  messageId: string;
  sentAt: string;
  type: RelayMessageType;
  payload: T;
}

export function parseRelayEnvelope(raw: unknown): RelayEnvelope {
  const base = BaseEnvelopeSchema.parse(raw);
  const schema = MessageSchemas[base.type as RelayMessageType];
  if (!schema) throw new Error(`Unknown relay message type: ${base.type}`);
  return {
    protocolVersion: RELAY_PROTOCOL_VERSION,
    messageId: base.messageId,
    sentAt: base.sentAt,
    type: base.type as RelayMessageType,
    payload: schema.parse(base.payload)
  };
}

export function createRelayEnvelope<T>(type: RelayMessageType, payload: T): RelayEnvelope<T> {
  return {
    protocolVersion: RELAY_PROTOCOL_VERSION,
    messageId: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
    type,
    payload
  };
}
