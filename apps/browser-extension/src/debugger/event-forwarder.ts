import { ExtensionAdapterError } from '../browser/inventory.js';
import type {
  DebuggerAttachmentManager,
  DebuggerApi,
  DebuggerDetachFact
} from './attachment-manager.js';

const DEFAULT_MAX_EVENT_BYTES = 1024 * 1024;

export interface CdpEventFact {
  privateTab: {
    tabId: number;
    tabGeneration: number;
    windowId: number;
    windowGeneration: number;
  };
  attachmentGeneration: number;
  childSessionId: string | null;
  eventSequence: number;
  method: string;
  params: object;
  receivedAt: string;
}

export interface EventForwarderSink {
  onEvent(event: CdpEventFact): void | Promise<void>;
  onDetach(fact: DebuggerDetachFact): void | Promise<void>;
  onError(error: ExtensionAdapterError): void | Promise<void>;
}

const sessionIdFrom = (params: object | undefined): string | null => {
  if (!params || typeof params !== 'object') return null;
  const value = (params as { sessionId?: unknown }).sessionId;
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export class CdpEventForwarder {
  private started = false;
  private removeDetachListener: (() => void) | null = null;
  private readonly onChromeEvent = (
    source: chrome.debugger.DebuggerSession,
    method: string,
    params: object = {}
  ): void => {
    if (source.tabId === undefined) return;
    if (method === 'Target.attachedToTarget') {
      const childSessionId = sessionIdFrom(params);
      if (childSessionId) this.attachments.registerChildSession(source.tabId, childSessionId);
    }
    const attachment = this.attachments.lookup(source);
    if (!attachment) return;

    const bytes = new TextEncoder().encode(JSON.stringify(params)).byteLength;
    if (bytes > this.maxEventBytes) {
      void this.sink.onError(new ExtensionAdapterError(
        'PAYLOAD_TOO_LARGE',
        `CDP event ${method} exceeds the relay payload limit.`
      ));
      return;
    }

    const event: CdpEventFact = {
      privateTab: attachment.privateTab,
      attachmentGeneration: attachment.attachmentGeneration,
      childSessionId: source.sessionId ?? null,
      eventSequence: this.attachments.nextEventSequence(source.tabId),
      method,
      params,
      receivedAt: new Date().toISOString()
    };
    void this.sink.onEvent(event);

    if (method === 'Target.detachedFromTarget') {
      const childSessionId = sessionIdFrom(params);
      if (childSessionId) this.attachments.unregisterChildSession(source.tabId, childSessionId);
    }
  };

  constructor(
    private readonly attachments: DebuggerAttachmentManager,
    private readonly sink: EventForwarderSink,
    private readonly api: DebuggerApi = attachments.api,
    private readonly maxEventBytes = DEFAULT_MAX_EVENT_BYTES
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.api.onEvent.addListener(this.onChromeEvent);
    this.removeDetachListener = this.attachments.onDetach((fact) => {
      void this.sink.onDetach(fact);
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.api.onEvent.removeListener?.(this.onChromeEvent);
    this.removeDetachListener?.();
    this.removeDetachListener = null;
  }
}
