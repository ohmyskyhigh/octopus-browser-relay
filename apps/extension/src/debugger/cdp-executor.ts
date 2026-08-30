import { ExtensionAdapterError, type PrivateTabLocator } from '../browser/inventory.js';
import type {
  RecentAttemptCache,
  RecentAttemptOutcome
} from '../executor/recent-command-cache.js';
import type { DebuggerAttachmentManager } from './attachment-manager.js';

const DEFAULT_MAX_PAYLOAD_BYTES = 1024 * 1024;
const METHOD_PATTERN = /^[A-Za-z][A-Za-z0-9_.]{0,127}$/;

const payloadBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;

export interface ExecuteCdpInput {
  attemptId: string;
  connectionGeneration: number;
  inventoryGeneration: number;
  privateTab: PrivateTabLocator;
  attachmentGeneration: number;
  method: string;
  params?: Record<string, unknown>;
  childSessionId?: string;
}

export interface ExecuteCdpSuccess {
  attemptId: string;
  connectionGeneration: number;
  inventoryGeneration: number;
  tabGeneration: number;
  attachmentGeneration: number;
  rawResult: object | null;
}

const asAdapterError = (error: unknown): ExtensionAdapterError => {
  if (error instanceof ExtensionAdapterError) return error;
  return new ExtensionAdapterError(
    'CDP_COMMAND_FAILED',
    error instanceof Error ? error.message : 'Chrome rejected the CDP command.',
    true
  );
};

export class CdpExecutor {
  constructor(
    private readonly attachments: DebuggerAttachmentManager,
    private readonly attempts: RecentAttemptCache,
    private readonly maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES
  ) {}

  async execute(input: ExecuteCdpInput): Promise<ExecuteCdpSuccess> {
    this.validateInput(input);
    try {
      this.attachments.assertAttached(input.privateTab, input.attachmentGeneration, input.childSessionId);
      const target: chrome.debugger.DebuggerSession = {
        tabId: input.privateTab.tabId,
        ...(input.childSessionId === undefined ? {} : { sessionId: input.childSessionId })
      };
      const rawResult = await this.attachments.api.sendCommand(target, input.method, input.params);
      if (payloadBytes(rawResult) > this.maxPayloadBytes) {
        throw new ExtensionAdapterError('PAYLOAD_TOO_LARGE', 'The CDP result exceeds the relay payload limit.');
      }
      const output: ExecuteCdpSuccess = {
        attemptId: input.attemptId,
        connectionGeneration: input.connectionGeneration,
        inventoryGeneration: input.inventoryGeneration,
        tabGeneration: input.privateTab.tabGeneration,
        attachmentGeneration: input.attachmentGeneration,
        rawResult: rawResult ?? null
      };
      await this.remember(input, { ok: true, output });
      return output;
    } catch (error) {
      const normalized = asAdapterError(error);
      await this.remember(input, {
        ok: false,
        error: { code: normalized.code, message: normalized.message }
      });
      throw normalized;
    }
  }

  private validateInput(input: ExecuteCdpInput): void {
    if (!METHOD_PATTERN.test(input.method)) {
      throw new ExtensionAdapterError('INVALID_CDP_METHOD', 'The CDP method name is invalid.');
    }
    if (!Number.isInteger(input.connectionGeneration) || input.connectionGeneration <= 0) {
      throw new ExtensionAdapterError('STALE_CONNECTION_GENERATION', 'The connection generation is invalid.');
    }
    if (payloadBytes(input.params) > this.maxPayloadBytes) {
      throw new ExtensionAdapterError('PAYLOAD_TOO_LARGE', 'The CDP command exceeds the relay payload limit.');
    }
  }

  private remember(
    input: ExecuteCdpInput,
    outcome: Pick<RecentAttemptOutcome, 'ok' | 'output' | 'error'>
  ): Promise<void> {
    return this.attempts.remember({
      attemptId: input.attemptId,
      connectionGeneration: input.connectionGeneration,
      inventoryGeneration: input.inventoryGeneration,
      tabId: input.privateTab.tabId,
      windowId: input.privateTab.windowId,
      windowGeneration: input.privateTab.windowGeneration,
      tabGeneration: input.privateTab.tabGeneration,
      attachmentGeneration: input.attachmentGeneration,
      operation: input.method,
      recordedAt: new Date().toISOString(),
      ...outcome
    });
  }
}
