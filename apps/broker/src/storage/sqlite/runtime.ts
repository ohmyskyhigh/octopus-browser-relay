import { DatabaseSync } from 'node:sqlite';

export type SqliteStatement = ReturnType<DatabaseSync['prepare']>;

/**
 * The deliberately small database surface used by the repositories. Keeping it
 * here prevents persistence code from depending on a native SQLite addon.
 */
export interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  pragma(sql: string): void;
  transaction<T>(work: () => T): () => T;
}

export class NodeSqliteDatabase implements SqliteDatabase {
  private readonly database: DatabaseSync;
  private transactionDepth = 0;
  private savepointSequence = 0;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
  }

  close(): void {
    this.database.close();
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  prepare(sql: string): SqliteStatement {
    return this.database.prepare(sql);
  }

  pragma(sql: string): void {
    this.database.exec(`PRAGMA ${sql}`);
  }

  transaction<T>(work: () => T): () => T {
    return () => {
      const nested = this.transactionDepth > 0;
      const savepoint = `octopus_sp_${++this.savepointSequence}`;
      this.database.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
      this.transactionDepth += 1;
      try {
        const result = work();
        this.transactionDepth -= 1;
        this.database.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
        return result;
      } catch (error) {
        this.transactionDepth -= 1;
        if (nested) {
          this.database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          this.database.exec(`RELEASE SAVEPOINT ${savepoint}`);
        } else {
          this.database.exec('ROLLBACK');
        }
        throw error;
      }
    };
  }
}
