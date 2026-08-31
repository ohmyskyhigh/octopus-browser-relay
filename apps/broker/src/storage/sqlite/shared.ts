import type { SqliteDatabase } from './runtime.js';
import type { SQLInputValue } from 'node:sqlite';

export type Row = Record<string, unknown>;

export const nowIso = (): string => new Date().toISOString();

export function parseJson<T>(value: unknown): T {
  if (typeof value !== 'string') throw new Error('Expected JSON string from database.');
  return JSON.parse(value) as T;
}

export function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function pageLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('INVALID_PAGE_LIMIT');
  return limit;
}

export function requireRow(db: SqliteDatabase, sql: string, values: SQLInputValue[], code: string): Row {
  const row = db.prepare(sql).get(...values) as Row | undefined;
  if (!row) throw new Error(code);
  return row;
}
