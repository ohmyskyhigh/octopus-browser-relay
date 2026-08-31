import { z } from 'zod';
import extensionBaseline from '../../capabilities/extension-baseline.json' with { type: 'json' };

const NullableVersionBoundSchema = z.string().min(1).max(64).nullable();
const NullableMajorSchema = z.number().int().nonnegative().nullable();

export const CapabilityManifestSchema = z.strictObject({
  manifestVersion: z.literal(1),
  manifestId: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  profile: z.enum(['conservative', 'reviewed']),
  relayProtocolVersion: z.literal(2),
  debuggerProtocolVersion: z.string().min(1).max(32),
  extensionVersion: z.strictObject({
    minInclusive: NullableVersionBoundSchema,
    maxExclusive: NullableVersionBoundSchema
  }),
  browser: z.strictObject({
    products: z.array(z.string().min(1).max(64)).min(1).max(16),
    minMajor: NullableMajorSchema,
    maxMajor: NullableMajorSchema
  }),
  features: z.strictObject({
    browserInventory: z.boolean(),
    tabGroups: z.boolean(),
    debuggerAttachment: z.boolean(),
    cdpEvents: z.boolean(),
    attemptReconciliation: z.boolean(),
    flattenedChildSessions: z.boolean()
  }),
  limits: z.strictObject({
    maxEnvelopeBytes: z.number().int().min(1024).max(16 * 1024 * 1024),
    maxInventoryWindows: z.number().int().positive().max(4096),
    maxTabsPerWindow: z.number().int().positive().max(65_536),
    maxGroupsPerWindow: z.number().int().positive().max(16_384),
    maxActiveAttempts: z.number().int().positive().max(4096),
    maxRecentAttemptOutcomes: z.number().int().positive().max(100_000)
  }),
  cdpMethods: z
    .array(
      z.strictObject({
        method: z.string().regex(/^[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*$/),
        scope: z.literal('managed_tab'),
        childSessions: z.boolean()
      })
    )
    .max(4096)
    .superRefine((methods, context) => {
      const seen = new Set<string>();
      for (const [index, method] of methods.entries()) {
        if (seen.has(method.method)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'method'],
            message: `Duplicate CDP method: ${method.method}`
          });
        }
        seen.add(method.method);
      }
    })
});

export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

export const CONSERVATIVE_CAPABILITY_MANIFEST: CapabilityManifest = Object.freeze(
  CapabilityManifestSchema.parse(extensionBaseline)
);

export interface CapabilitySelectionFacts {
  readonly relayProtocolVersion: number;
  readonly extensionVersion: string;
  readonly browserProduct: string;
  readonly browserMajor: number | null;
  readonly advertisedManifestIds: readonly string[];
}

export interface CapabilitySelection {
  readonly manifest: CapabilityManifest;
  readonly basis: 'advertised_reviewed_profile' | 'conservative_fallback';
}

export class CapabilitySelectionError extends Error {
  readonly code = 'CAPABILITY_PROFILE_UNAVAILABLE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CapabilitySelectionError';
  }
}

function supportsBrowser(manifest: CapabilityManifest, facts: CapabilitySelectionFacts): boolean {
  if (!manifest.browser.products.some((product) => facts.browserProduct.includes(product))) return false;
  if (facts.browserMajor === null) return true;
  if (manifest.browser.minMajor !== null && facts.browserMajor < manifest.browser.minMajor) return false;
  if (manifest.browser.maxMajor !== null && facts.browserMajor >= manifest.browser.maxMajor) return false;
  return true;
}

/**
 * Reviewed profiles are selected only when the extension advertised their exact
 * checked-in id and their browser bounds match. Unknown combinations fall back to
 * the conservative baseline unless the caller explicitly requires rejection.
 */
export function selectCapabilityManifest(
  facts: CapabilitySelectionFacts,
  reviewedManifests: readonly CapabilityManifest[] = [],
  unknownPolicy: 'conservative' | 'reject' = 'conservative'
): CapabilitySelection {
  if (facts.relayProtocolVersion !== 2) {
    throw new CapabilitySelectionError(`Relay protocol ${facts.relayProtocolVersion} is unsupported.`);
  }

  const selected = reviewedManifests.find(
    (manifest) =>
      manifest.profile === 'reviewed' &&
      facts.advertisedManifestIds.includes(manifest.manifestId) &&
      supportsBrowser(manifest, facts)
  );

  if (selected) return { manifest: CapabilityManifestSchema.parse(selected), basis: 'advertised_reviewed_profile' };
  if (unknownPolicy === 'reject') {
    throw new CapabilitySelectionError(
      `No reviewed capability profile matches ${facts.browserProduct} and extension ${facts.extensionVersion}.`
    );
  }
  return { manifest: CONSERVATIVE_CAPABILITY_MANIFEST, basis: 'conservative_fallback' };
}

export function supportsCdpMethod(manifest: CapabilityManifest, method: string, usesChildSession = false): boolean {
  const capability = manifest.cdpMethods.find((candidate) => candidate.method === method);
  return capability !== undefined && (!usesChildSession || capability.childSessions);
}

