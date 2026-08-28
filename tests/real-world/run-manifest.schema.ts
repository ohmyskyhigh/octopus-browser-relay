import { z } from 'zod';

export const RealWorldRunManifestSchema = z.strictObject({
  runId: z.string().min(8).max(128),
  createdAt: z.string().datetime(),
  brokerVersion: z.string(),
  extensionVersion: z.string(),
  protocolVersion: z.literal(1),
  dbPath: z.string().min(1),
  adminTokenFile: z.string().min(1),
  mcpUrl: z.string().url(),
  relayUrl: z.string().url(),
  fixtureBaseUrl: z.string().url(),
  extensionPath: z.string().min(1),
  targets: z.array(z.strictObject({
    alias: z.string(),
    marker: z.string(),
    fixtureUrl: z.string().url()
  })).length(3),
  agents: z.array(z.strictObject({
    role: z.enum(['A', 'B', 'C']),
    principalId: z.string().uuid(),
    principalLabel: z.string(),
    tokenFile: z.string().min(1),
    roleCard: z.string().min(1)
  })).length(3)
});

export type RealWorldRunManifest = z.infer<typeof RealWorldRunManifestSchema>;
