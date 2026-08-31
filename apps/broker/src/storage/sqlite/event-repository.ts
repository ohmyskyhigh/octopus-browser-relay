import type {
  EventRecoverySnapshot,
  EventRepository,
  StoredCdpEvent,
  StoredEventCursor,
  StoredEventStream
} from '../repositories.js';
import type { SqliteDatabase } from './runtime.js';
import { nowIso, nullableString, pageLimit, parseJson, type Row } from './shared.js';

function toStream(row: Row): StoredEventStream {
  return {
    streamRef: String(row.stream_ref), tabRef: String(row.tab_ref), streamGeneration: Number(row.stream_generation),
    initialCursorRef: String(row.initial_cursor_ref), baseline: parseJson(row.baseline_json), nextSequence: Number(row.next_sequence),
    state: String(row.state) as StoredEventStream['state'], createdAt: String(row.created_at), endedAt: nullableString(row.ended_at)
  };
}

function toCursor(row: Row): StoredEventCursor {
  return {
    cursorRef: String(row.cursor_ref), streamRef: String(row.stream_ref), sequence: Number(row.sequence),
    queryHash: String(row.query_hash), ownerEpoch: Number(row.owner_epoch), issuedAt: String(row.issued_at), expiresAt: nullableString(row.expires_at)
  };
}

function toEvent(row: Row): StoredCdpEvent {
  return {
    streamRef: String(row.stream_ref), sequence: Number(row.sequence), method: String(row.method), params: parseJson(row.params_json),
    connectionGeneration: Number(row.connection_generation), observedAt: String(row.observed_at)
  };
}

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: SqliteDatabase) {}

  createStream(input: Parameters<EventRepository['createStream']>[0]): { stream: StoredEventStream; cursor: StoredEventCursor } {
    return this.db.transaction(() => {
      const at = input.at ?? nowIso();
      const generationRow = this.db.prepare('SELECT COALESCE(MAX(stream_generation),0) AS value FROM event_streams WHERE tab_ref = ?')
        .get(input.tabRef) as Row;
      const streamGeneration = Number(generationRow.value) + 1;
      this.db.prepare(`INSERT INTO event_streams(stream_ref,tab_ref,stream_generation,initial_cursor_ref,baseline_json,created_at)
        VALUES(?,?,?,?,?,?)`).run(input.streamRef, input.tabRef, streamGeneration, input.initialCursorRef, JSON.stringify(input.baseline), at);
      this.db.prepare(`INSERT INTO event_cursors(cursor_ref,stream_ref,sequence,query_hash,owner_epoch,issued_at,expires_at)
        VALUES(?,?,0,?,?,?,?)`).run(input.initialCursorRef, input.streamRef, input.queryHash, input.ownerEpoch, at, input.cursorExpiresAt ?? null);
      return this.getStreamAndCursor(input.streamRef, input.initialCursorRef);
    })();
  }

  private getStreamAndCursor(streamRef: string, cursorRef: string): { stream: StoredEventStream; cursor: StoredEventCursor } {
    const stream = this.db.prepare('SELECT * FROM event_streams WHERE stream_ref = ?').get(streamRef) as Row | undefined;
    const cursor = this.db.prepare('SELECT * FROM event_cursors WHERE cursor_ref = ?').get(cursorRef) as Row | undefined;
    if (!stream || !cursor) throw new Error('EVENT_STREAM_NOT_FOUND');
    return { stream: toStream(stream), cursor: toCursor(cursor) };
  }

  appendEvent(input: Parameters<EventRepository['appendEvent']>[0]): { event: StoredCdpEvent; cursor: StoredEventCursor } {
    return this.db.transaction(() => {
      const at = input.observedAt ?? nowIso();
      const row = this.db.prepare(`SELECT * FROM event_streams WHERE stream_ref = ? AND state = 'active'`).get(input.streamRef) as Row | undefined;
      if (!row) throw new Error('EVENT_STREAM_NOT_ACTIVE');
      const sequence = Number(row.next_sequence);
      this.db.prepare(`INSERT INTO cdp_events(stream_ref,sequence,method,params_json,connection_generation,observed_at)
        VALUES(?,?,?,?,?,?)`).run(input.streamRef, sequence, input.method, JSON.stringify(input.params), input.connectionGeneration, at);
      this.db.prepare(`INSERT INTO event_cursors(cursor_ref,stream_ref,sequence,query_hash,owner_epoch,issued_at,expires_at)
        VALUES(?,?,?,?,?,?,?)`).run(input.cursorRef, input.streamRef, sequence, input.queryHash, input.ownerEpoch, at, input.cursorExpiresAt ?? null);
      this.db.prepare('UPDATE event_streams SET next_sequence = next_sequence + 1 WHERE stream_ref = ?').run(input.streamRef);
      const event = toEvent(this.db.prepare('SELECT * FROM cdp_events WHERE stream_ref = ? AND sequence = ?').get(input.streamRef, sequence) as Row);
      const cursor = toCursor(this.db.prepare('SELECT * FROM event_cursors WHERE cursor_ref = ?').get(input.cursorRef) as Row);
      return { event, cursor };
    })();
  }

  readEvents(input: Parameters<EventRepository['readEvents']>[0]): { events: StoredCdpEvent[]; cursor: StoredEventCursor; stream: StoredEventStream } | null {
    const at = input.at ?? nowIso();
    const cursorRow = this.db.prepare(`SELECT * FROM event_cursors WHERE cursor_ref = ? AND query_hash = ? AND owner_epoch = ?
      AND (expires_at IS NULL OR expires_at > ?)`).get(input.cursorRef, input.queryHash, input.ownerEpoch, at) as Row | undefined;
    if (!cursorRow) return null;
    const cursor = toCursor(cursorRow);
    const streamRow = this.db.prepare('SELECT * FROM event_streams WHERE stream_ref = ?').get(cursor.streamRef) as Row | undefined;
    if (!streamRow) return null;
    const limit = pageLimit(input.limit);
    const events = (this.db.prepare(`SELECT * FROM cdp_events WHERE stream_ref = ? AND sequence > ? ORDER BY sequence LIMIT ?`)
      .all(cursor.streamRef, cursor.sequence, limit) as Row[]).map(toEvent);
    let nextCursor = cursor;
    const last = events.at(-1);
    if (last) {
      const nextRow = this.db.prepare(`SELECT * FROM event_cursors WHERE stream_ref = ? AND sequence = ? AND query_hash = ? AND owner_epoch = ?`)
        .get(cursor.streamRef, last.sequence, input.queryHash, input.ownerEpoch) as Row | undefined;
      if (!nextRow) throw new Error('EVENT_CURSOR_MISSING');
      nextCursor = toCursor(nextRow);
    }
    return { events, cursor: nextCursor, stream: toStream(streamRow) };
  }

  replaceStreamBaseline(input: Parameters<EventRepository['replaceStreamBaseline']>[0]): { stream: StoredEventStream; cursor: StoredEventCursor } {
    return this.db.transaction(() => {
      const at = input.at ?? nowIso();
      this.db.prepare(`UPDATE event_streams SET state = 'replaced', ended_at = ? WHERE tab_ref = ? AND state = 'active'`).run(at, input.tabRef);
      return this.createStream(input);
    })();
  }

  scanEventRecovery(): EventRecoverySnapshot {
    const streams = (this.db.prepare(`SELECT * FROM event_streams WHERE state = 'active' ORDER BY tab_ref`).all() as Row[]).map(toStream);
    return { streams };
  }
}
