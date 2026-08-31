import { randomBytes } from 'node:crypto';

export type OctopusReferenceKind = 'session' | 'lineage' | 'extension' | 'browser' | 'window' | 'workspace' | 'tab' | 'request' | 'cursor';

const prefixes: Readonly<Record<OctopusReferenceKind, string>> = {
  session: 'ses',
  lineage: 'lin',
  extension: 'ext',
  browser: 'brw',
  window: 'win',
  workspace: 'wrk',
  tab: 'tab',
  request: 'req',
  cursor: 'cur'
};

export interface ReferenceFactory {
  issue(kind: OctopusReferenceKind): string;
}

export class RandomReferenceFactory implements ReferenceFactory {
  issue(kind: OctopusReferenceKind): string {
    return `${prefixes[kind]}_${randomBytes(18).toString('base64url')}`;
  }
}

export class DeterministicReferenceFactory implements ReferenceFactory {
  private counter = 0;

  issue(kind: OctopusReferenceKind): string {
    this.counter += 1;
    return `${prefixes[kind]}_test_${String(this.counter).padStart(6, '0')}`;
  }
}
