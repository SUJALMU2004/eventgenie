import {
  requestValue,
  transactionDone,
  type Database,
  type StoreName,
} from "./database";
export function createRecordStore(connection: Database) {
  const { open } = connection;
  async function read(store: StoreName, key: string): Promise<unknown> {
    const database = await open();
    try {
      return await requestValue(
        database.transaction(store, "readonly").objectStore(store).get(key),
      );
    } finally {
      database.close();
    }
  }
  async function write(
    store: StoreName,
    key: string,
    data: unknown,
  ): Promise<void> {
    const database = await open();
    try {
      const transaction = database.transaction(store, "readwrite");
      const done = transactionDone(transaction);
      transaction.objectStore(store).put({ version: 1, data }, key);
      await done;
    } finally {
      database.close();
    }
  }
  async function remove(stores: StoreName[], key: string): Promise<void> {
    const database = await open();
    try {
      const transaction = database.transaction(stores, "readwrite");
      const done = transactionDone(transaction);
      for (const store of stores) transaction.objectStore(store).delete(key);
      await done;
    } finally {
      database.close();
    }
  }

  return { read, write, remove };
}
