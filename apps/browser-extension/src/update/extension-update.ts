export type ExtensionReloadDecision =
  | { kind: 'continue' }
  | { kind: 'reload'; requiredVersion: string }
  | { kind: 'blocked'; message: string };

export function decideExtensionReload(input: {
  currentVersion: string;
  requiredVersion: string;
  reloadRequested: boolean;
  attemptedVersion: string | null;
}): ExtensionReloadDecision {
  const matches = input.currentVersion === input.requiredVersion;
  if (matches && !input.reloadRequested) return { kind: 'continue' };
  if (matches) {
    return {
      kind: 'blocked',
      message: `The broker requested an extension reload even though version ${input.currentVersion} already matches.`
    };
  }
  if (!input.reloadRequested) {
    return {
      kind: 'blocked',
      message: `Extension ${input.currentVersion} does not match required version ${input.requiredVersion}, but the broker did not authorize reload.`
    };
  }
  if (input.attemptedVersion === input.requiredVersion) {
    return {
      kind: 'blocked',
      message: `Extension files are still version ${input.currentVersion} after reloading for ${input.requiredVersion}. Run the local updater again or reload the installed extension directory.`
    };
  }
  return { kind: 'reload', requiredVersion: input.requiredVersion };
}

export function normalizeLegacyReadyEnvelope(input: unknown, currentVersion: string): unknown {
  if (!input || typeof input !== 'object') return input;
  const envelope = input as Record<string, unknown>;
  if (envelope.version !== 2 || envelope.type !== 'READY' || !envelope.payload || typeof envelope.payload !== 'object') {
    return input;
  }
  const payload = envelope.payload as Record<string, unknown>;
  if (
    'brokerVersion' in payload ||
    'requiredExtensionVersion' in payload ||
    'reloadExtension' in payload
  ) {
    return input;
  }
  return {
    ...envelope,
    payload: {
      ...payload,
      brokerVersion: currentVersion,
      requiredExtensionVersion: currentVersion,
      reloadExtension: false
    }
  };
}
