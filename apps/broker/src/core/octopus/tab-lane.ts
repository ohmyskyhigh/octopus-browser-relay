import { isTerminalRequestState, type OctopusRequestState } from './request-state-machine.js';

export interface TabLaneEntry {
  requestRef: string;
  position: number;
  acknowledgement: 'pending' | 'delivered' | 'failed';
  state: OctopusRequestState;
  claimed: boolean;
}

export class TabLane {
  private readonly entries: TabLaneEntry[] = [];
  private nextPosition = 1;

  accept(requestRef: string): TabLaneEntry {
    if (this.entries.some((entry) => entry.requestRef === requestRef)) {
      throw new Error(`Request already belongs to this tab lane: ${requestRef}`);
    }
    const entry: TabLaneEntry = {
      requestRef,
      position: this.nextPosition,
      acknowledgement: 'pending',
      state: 'queued',
      claimed: false
    };
    this.nextPosition += 1;
    this.entries.push(entry);
    return { ...entry };
  }

  acknowledge(requestRef: string, delivered: boolean): void {
    const entry = this.require(requestRef);
    if (entry.acknowledgement !== 'pending') throw new Error('Acknowledgement outcome is already recorded.');
    entry.acknowledgement = delivered ? 'delivered' : 'failed';
    if (!delivered) entry.state = 'failed';
  }

  claimHead(): TabLaneEntry | null {
    const head = this.entries.find((entry) => entry.acknowledgement !== 'failed' && !isTerminalRequestState(entry.state));
    if (!head || head.acknowledgement !== 'delivered' || head.claimed) return null;
    head.claimed = true;
    head.state = 'running';
    return { ...head };
  }

  releaseClaim(requestRef: string): void {
    const entry = this.require(requestRef);
    entry.claimed = false;
  }

  terminalize(requestRef: string, state: Extract<OctopusRequestState, 'succeeded' | 'failed' | 'uncertain'>): void {
    const entry = this.require(requestRef);
    entry.state = state;
    entry.claimed = false;
  }

  snapshot(): TabLaneEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  private require(requestRef: string): TabLaneEntry {
    const entry = this.entries.find((candidate) => candidate.requestRef === requestRef);
    if (!entry) throw new Error(`Request is not in this tab lane: ${requestRef}`);
    return entry;
  }
}
