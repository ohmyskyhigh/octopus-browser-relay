import type { AuditRepository, Page, StoredCanonicalAuditEvent } from '../repositories.js';
import type { SqliteDatabase } from './runtime.js';
import type { SQLInputValue } from 'node:sqlite';
import { nowIso, nullableString, pageLimit, parseJson, type Row } from './shared.js';

function toAudit(row: Row): StoredCanonicalAuditEvent {
  return {
    auditRef: String(row.audit_ref), eventType: String(row.event_type), actorSessionRef: nullableString(row.actor_session_ref),
    endpointRef: nullableString(row.endpoint_ref), workspaceRef: nullableString(row.workspace_ref), tabRef: nullableString(row.tab_ref),
    requestRef: nullableString(row.request_ref), context: parseJson(row.context_json), observedAt: String(row.observed_at)
  };
}

export class SqliteAuditRepository implements AuditRepository {
  constructor(private readonly db: SqliteDatabase) {}

  append(input: Parameters<AuditRepository['append']>[0]): StoredCanonicalAuditEvent {
    const at = input.observedAt ?? nowIso();
    this.db.prepare(`INSERT INTO canonical_audit_events(audit_ref,event_type,actor_session_ref,endpoint_ref,workspace_ref,tab_ref,request_ref,context_json,observed_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(input.auditRef, input.eventType, input.actorSessionRef ?? null, input.endpointRef ?? null,
      input.workspaceRef ?? null, input.tabRef ?? null, input.requestRef ?? null, JSON.stringify(input.context ?? {}), at);
    return toAudit(this.db.prepare('SELECT * FROM canonical_audit_events WHERE audit_ref = ?').get(input.auditRef) as Row);
  }

  list(input: Parameters<AuditRepository['list']>[0]): Page<StoredCanonicalAuditEvent> {
    const limit = pageLimit(input.page.limit);
    const clauses = ['audit_ref > ?'];
    const values: SQLInputValue[] = [input.page.after ?? ''];
    if (input.requestRef) { clauses.push('request_ref = ?'); values.push(input.requestRef); }
    if (input.workspaceRef) { clauses.push('workspace_ref = ?'); values.push(input.workspaceRef); }
    values.push(limit + 1);
    const rows = this.db.prepare(`SELECT * FROM canonical_audit_events WHERE ${clauses.join(' AND ')} ORDER BY audit_ref LIMIT ?`).all(...values) as Row[];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toAudit);
    return { items, next: hasMore ? items.at(-1)?.auditRef ?? null : null };
  }
}
