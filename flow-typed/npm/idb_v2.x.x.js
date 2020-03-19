// flow-typed signature: 266e43152fad31355599ae324f4f5924
// flow-typed version: 42ca8a9a47/idb_v2.x.x/flow_>=v0.34.x

// Derived from TS typings at https://github.com/jakearchibald/idb/blob/c8bab898f01bacab96097f87c1e42a0c19e01425/lib/idb.d.ts

type IDBArrayKey = Array<IDBValidKey>;
type IDBValidKey = number | string | Date | IDBArrayKey;

// TODO: upstream this to Flow DOM definitions
declare class DOMStringList {
  +length: number;
  // Comment syntax here as @@iterator is invalid syntax for eslint and babylon
  /*:: @@iterator(): Iterator<string>; */
  contains(str: string): boolean;
  item(index: number): string | null;
  [index: number]: string;
}

declare module 'idb' {
  /** This is your entry point to the API. It's exposed to the global scope unless you're using a module system such as browserify, in which case it's the exported object. */
  declare module.exports: IDBStatic;

  /**
   * This is a tiny library that mirrors IndexedDB, but replaces IDBRequest objects with promises.
   * This is your entry point to the API. It's exposed to the global scope unless you're using a module system such as browserify, in which case it's the exported object.
   */
  declare interface IDBStatic {
    /**
     * This method returns a promise that resolves to a DB.
     * @param name The name of the database.
     * @param version Optional. The version to open the database with. If the version is not provided and the database exists, then a connection to the database will be opened without changing its version. If the version is not provided and the database does not exist, then it will be created with version 1.
     * @param upgradeCallback Optional. Called if version is greater than the version last opened. It's similar to IDB's onupgradeneeded. The callback receives an instance of UpgradeDB.
     * @returns A Promise that passes the DB once it has been opened.
     */
    open(
      name: string,
      version?: number,
      upgradeCallback?: (db: UpgradeDB) => void
    ): Promise<DB>;

    /**
     * Behaves like indexedDB.deleteDatabase, but returns a promise.
     * @param name The name of the database.
     * @returns A Promise that completes once the DB has been removed.
     */
    delete(name: string): Promise<void>;
  }

  /** Similar to equivalent IDBDatabase. */
  declare interface DB {
    /** A DOMString that contains the name of the connected database. */
    +name: string;

    /** A 64-bit integer that contains the version of the connected database. When a database is first created, this attribute is an empty string. */
    +version: number;

    /** A DOMStringList that contains a list of the names of the object stores currently in the connected database. */
    +objectStoreNames: DOMStringList;

    /** Returns immediately and closes the connection to a database in a separate thread. */
    close(): void;

    /**
     * Immediately returns a transaction object (Transaction) containing the IDBTransaction.objectStore method, which you can use to access your object store. Runs in a separate thread.
     * @param storeNames The names of object stores and indexes that are in the scope of the new transaction, declared as an array of strings. Specify only the object stores that you need to access.
     * If you need to access only one object store, you can specify its name as a string.
     * @param mode Optional. The types of access that can be performed in the transaction. Transactions are opened in one of three modes: 'readonly' or 'readwrite'. 'versionchange' mode can't be specified here. If you don't provide the parameter, the default access mode is readonly. To avoid slowing things down, don't open a readwrite transaction unless you actually need to write into the database.
     * @returns The transaction object.
     */
    transaction(
      storeNames: string | Array<string>,
      mode?: 'readonly' | 'readwrite'
    ): Transaction;
  }

  /** Represent the equivalent IDBDatabase during an upgrade. */
  declare interface UpgradeDB {
    /** A DOMString that contains the name of the connected database. */
    +name: string;

    /** A 64-bit integer that contains the version of the connected database. When a database is first created, this attribute is an empty string. */
    +version: number;

    /** The previous version of the DB seen by the browser, or 0 if it's new */
    +oldVersion: number;

    /** A DOMStringList that contains a list of the names of the object stores currently in the connected database. */
    +objectStoreNames: DOMStringList;

    /** This is a property rather than a method. It's a Transaction representing the upgrade transaction */
    +transaction: Transaction;

    /**
     * Creates and returns a new object store or index.
     * @param name The name of the new object store to be created. Note that it is possible to create an object store with an empty name.
     * @param optionalParameters Optional. An options object whose attributes are optional parameters to the method.
     * @returns The new object store.
     */
    createObjectStore(
      name: string,
      optionalParameters?: {
        keyPath?: string,
        autoIncrement?: boolean,
      }
    ): ObjectStore;

    /**
     * Destroys the object store with the given name in the connected database, along with any indexes that reference it.
     * @param name The name of the object store to be removed.
     */
    deleteObjectStore(name: string): void;
  }

  /** Wrapper of IDBTransaction that presents the asynchronous operations as a Promise. */
  declare interface Transaction {
    /** Resolves when transaction completes, rejects if transaction aborts or errors. */
    +complete: Promise<void>;

    /** Returns a DOMStringList of the names of IDBObjectStore objects. */
    +objectStoreNames: DOMStringList;

    /** The mode for isolating access to data in the object stores that are in the scope of the transaction. For possible values, see the Constants section below. The default value is readonly. */
    +mode: 'readonly' | 'readwrite' | 'versionchange';

    /** Rolls back all the changes to objects in the database associated with this transaction. If this transaction has been aborted or completed, then this method throws an error event. */
    abort(): void;

    /**
     * Returns an ObjectStore object representing an object store that is part of the scope of this transaction.
     * @param name The name of the requested object store.
     * @returns The object store in the context of the transaction.
     */
    objectStore(name: string): ObjectStore;
  }

  /** Common interface for ObjectStore and Index, since bothe provide these cursor methods */
  declare interface HasCursor {
    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves a new cursor object.
     * Used for iterating through an object store by primary key with a cursor.
     * @param range Optional. A key or IDBKeyRange to be queried. If a single valid key is passed, this will default to a range containing only that key. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param direction Optional. An IDBCursorDirection telling the cursor what direction to travel. Defaults to "next".
     * @returns A promise that resolves with the cursor once it has been opened.
     */
    openCursor(
      range?: IDBKeyRange | IDBValidKey | null,
      direction?: 'next' | 'nextunique' | 'prev' | 'prevunique'
    ): Promise<Cursor>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves a new cursor object.
     * Used for iterating through an object store with a key.
     * @param range Optional. A key or IDBKeyRange to be queried. If a single valid key is passed, this will default to a range containing only that key. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param direction Optional. An IDBCursorDirection telling the cursor what direction to travel. Defaults to "next".
     * @returns A promise that resolves with the cursor once it has been opened.
     */
    openKeyCursor(
      range?: IDBKeyRange | IDBValidKey | null,
      direction?: 'next' | 'nextunique' | 'prev' | 'prevunique'
    ): Promise<Cursor>;

    /**
     * Due to the microtask issues in some browsers, iterating over a cursor using promises doesn't always work.
     * So in the mean time, iterateCursor maps to openCursor, takes identical arguments, plus an additional callback that receives an IDBCursor
     */
    iterateCursor(callback: (c: Cursor) => void): void;
    iterateCursor(
      range: IDBKeyRange | IDBValidKey | null,
      callback: (c: Cursor) => void
    ): void;
    iterateCursor(
      range: IDBKeyRange | IDBValidKey | null,
      direction: 'next' | 'nextunique' | 'prev' | 'prevunique',
      callback: (c: Cursor) => void
    ): void;

    /**
     * Due to the microtask issues in some browsers, iterating over a cursor using promises doesn't always work.
     * So in the mean time, iterateKeyCursor maps to openKeyCursor, takes identical arguments, plus an additional callback that receives an IDBCursor
     */
    iterateKeyCursor(callback: (c: Cursor) => void): void;
    iterateKeyCursor(
      range: IDBKeyRange | IDBValidKey | null,
      callback: (c: Cursor) => void
    ): void;
    iterateKeyCursor(
      range: IDBKeyRange | IDBValidKey | null,
      direction: 'next' | 'nextunique' | 'prev' | 'prevunique',
      callback: (c: Cursor) => void
    ): void;
  }

  /** Wrapper of IDBObjectStore that presents the asynchronous operations as Promises. */
  declare interface ObjectStore extends HasCursor {
    /** The name of this object store. Settable only during upgrades. */
    name: string;

    /** The key path of this object store. If this attribute is null, the application must provide a key for each modification operation. */
    +keyPath: string | Array<string>;

    /** A list of the names of indexes on objects in this object store. */
    +indexNames: DOMStringList;

    /** The value of the auto increment flag for this object store. */
    +autoIncrement: boolean;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) creates a structured clone of the value, and updates the cloned value in the object store.
     * This is for updating existing records in an object store when the transaction's mode is readwrite.
     * @param value The value to be stored.
     * @param key Optional. The key to use to identify the record. If unspecified, it results to null.
     * @returns A promise that resolves with the new key when the underlying put IDBRequest is successful.
     */
    put(value: any, key?: IDBKeyRange | IDBValidKey): Promise<IDBValidKey>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) creates a structured clone of the value, and stores the cloned value in the object store.
     * This is for adding new records to an object store.
     * @param value The value to be stored.
     * @param key Optional. The key to use to identify the record. If unspecified, it results to null.
     * @returns A promise that resolves with the new key when the underlying add IDBRequest is successful.
     */
    add(value: any, key?: IDBKeyRange | IDBValidKey): Promise<IDBValidKey>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) deletes the store object specified.
     * This is for deleting individual records out of an object store.
     * @param key The key of the record to be deleted, or an IDBKeyRange to delete all records with keys in range.
     * @returns A promise that resolves when the underlying delete IDBRequest is successful.
     */
    delete(key: IDBKeyRange | IDBValidKey): Promise<void>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) clears the object store.
     * This is for deleting all current records out of an object store.
     * @returns A promise that resolves when the underlying clear IDBRequest is successful.
     */
    clear(): Promise<void>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with the store object store selected by the specified key.
     * This is for retrieving specific records from an object store.
     * @param key The key or key range that identifies the record to be retrieved.
     * @returns A promise that resolves with the item when the underlying get IDBRequest is successful.
     */
    get(key: any): Promise<any>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with the objects in the object store matching the specified parameter or all objects in the store if no parameters are given.
     * @param query Optional. A key or IDBKeyRange to be queried. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param count Optional. Specifies the number of values to return if more than one is found. If it is lower than 0 or greater than 232-1 a TypeError exception will be thrown.
     * @returns A promise that resolves with the items when the underlying getAll IDBRequest is successful.
     */
    getAll(
      query?: IDBKeyRange | IDBValidKey,
      count?: number
    ): Promise<Array<any>>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) finds either the given key or the primary key, if key is an IDBKeyRange.
     * @param key The key or key range that identifies the record to be retrieved.
     * @returns A promise that resolves with the item when the underlying get IDBRequest is successful.
     */
    getKey(key: IDBKeyRange | IDBValidKey): Promise<any>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with record keys for all the objects matching the specified parameter or all record keys in the store if no parameters are given.
     * @param query Optional. A key or IDBKeyRange to be queried. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param count Optional. Specifies the number of values to return if more than one is found. If it is lower than 0 or greater than 232-1 a TypeError exception will be thrown.
     * @returns A promise that resolves with the record keys when the underlying getAllKeys IDBRequest is successful.
     */
    getAllKeys(query?: IDBKeyRange, count?: number): Promise<Array<any>>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) counts the matching records.
     * If no arguments are provided, it returns the total number of records in the store.
     * @param key A key or IDBKeyRange object that specifies a range of records you want to count.
     * @returns A promise that resolves with the total when the underlying count IDBRequest is successful.
     */
    count(key?: IDBKeyRange | IDBValidKey): Promise<number>;

    /**
     * Creates a new index during a version upgrade, returning a new Index object in the connected database.
     * @param name The name of the index to create. It is possible to create an index with an empty name.
     * @param keyPath The key path for the index to use. It is possible to create an index with an empty keyPath, and also to pass in an array as a keyPath.
     * @param optionalParameters Additional options: unique and multiEntry.
     * @returns The newly created index.
     */
    createIndex(
      name: string,
      keyPath: string | Array<string>,
      optionalParameters?: {
        unique?: boolean,
        multiEntry?: boolean,
        locale?: string | 'auto' | null,
      }
    ): Index;

    /**
     * Destroys the specified index in the connected database, used during a version upgrade.
     * @param indexName The name of the existing index to remove.
     */
    deleteIndex(indexName: string): void;

    /**
     * Opens an index from this object store after which it can, for example, be used to return a sequence of records sorted by that index using a cursor.
     * @param name The name of the existing index to get.
     * @returns The specified index.
     */
    index(name: string): Index;
  }

  /** Wrapper of IDBIndex that presents the asynchronous operations as Promises. */
  declare interface Index extends HasCursor {
    /** The name of this index. */
    +name: string;

    /** The key path of this index. If null, this index is not auto-populated. */
    +keyPath: string | Array<string>;

    /**
     * Affects how the index behaves when the result of evaluating the index's key path yields an array.
     * If true, there is one record in the index for each item in an array of keys.
     * If false, then there is one record for each key that is an array.
     */
    +multiEntry: boolean;

    /** If true, this index does not allow duplicate values for a key. */
    +unique: boolean;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) counts the matching records.
     * If no arguments are provided, it returns the total number of records in the store.
     * @param key A key or IDBKeyRange object that specifies a range of records you want to count.
     * @returns A promise that resolves with the total when the underlying count IDBRequest is successful.
     */
    count(key?: IDBKeyRange | IDBValidKey): Promise<number>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with the store object store selected by the specified key.
     * This is for retrieving specific records from an object store.
     * @param key The key or key range that identifies the record to be retrieved.
     * @returns A promise that resolves with the item when the underlying get IDBRequest is successful.
     */
    get(key: IDBKeyRange | IDBValidKey): Promise<any>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) finds either the given key or the primary key, if key is an IDBKeyRange.
     * @param key The key or key range that identifies the record to be retrieved.
     * @returns A promise that resolves with the item when the underlying get IDBRequest is successful.
     */
    getKey(key: IDBKeyRange | IDBValidKey): Promise<any>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with the objects in the object store matching the specified parameter or all objects in the store if no parameters are given.
     * @param query Optional. A key or IDBKeyRange to be queried. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param count Optional. Specifies the number of values to return if more than one is found. If it is lower than 0 or greater than 232-1 a TypeError exception will be thrown.
     * @returns A promise that resolves with the items when the underlying getAll IDBRequest is successful.
     */
    getAll(
      query?: IDBKeyRange | IDBValidKey,
      count?: number
    ): Promise<Array<any>>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) resolves with record keys for all the objects matching the specified parameter or all record keys in the store if no parameters are given.
     * @param query Optional. A key or IDBKeyRange to be queried. If nothing is passed, this will default to a key range that selects all the records in this object store.
     * @param count Optional. Specifies the number of values to return if more than one is found. If it is lower than 0 or greater than 232-1 a TypeError exception will be thrown.
     * @returns A promise that resolves with the record keys when the underlying getAllKeys IDBRequest is successful.
     */
    getAllKeys(query?: IDBKeyRange, count?: number): Promise<Array<any>>;
  }

  /** Wrapper of IDBCursor that presents the asynchronous operations as Promises. */
  declare interface Cursor {
    /** The key for the record at the cursor's position. If the cursor is outside its range, this is set to undefined. The cursor's key can be any data type. */
    +key: IDBKeyRange | IDBValidKey;

    /** The cursor's current effective primary key. If the cursor is currently being iterated or has iterated outside its range, this is set to undefined. The cursor's primary key can be any data type. */
    +primaryKey: any;

    /** The direction of traversal of the cursor. */
    +direction: 'next' | 'nextunique' | 'prev' | 'prevunique';

    /** The current value under the cursor. */
    +value: any;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) deletes the record at the cursor's position, without changing the cursor's position.
     * This can be used to delete specific records.
     * @returns A promise that resolves when the underlying delete IDBRequest is successful.
     */
    delete(): Promise<void>;

    /**
     * Returns a Promise of an IDBRequest object that (in a separate thread) updates the value at the current position of the cursor in the object store.
     * This can be used to update specific records.
     * @param value The value to write over the current cursor location.
     * @returns A promise that resolves when the underlying update IDBRequest is successful.
     */
    update(value: any): Promise<void>;

    /**
     * Sets the number times a cursor should move its position forward.
     * @param count The number of times to move the cursor forward.
     * @returns The cursor after having been moved forward the specified number of times.
     */
    advance(count: number): Promise<Cursor>;

    /**
     * Advances the cursor to the next position along its direction, to the item whose key matches the optional key parameter.
     * @param key Optional. The key to position the cursor at. If no key is specified, the cursor advances to the immediate next position, based on the its direction.
     * @returns The cursor after having been continued to the next or specified record.
     */
    continue(key?: IDBKeyRange | IDBValidKey): Promise<Cursor>;

    /**
     * Sets the cursor to the given index key and primary key given as arguments.
     * @param key The key to position the cursor at.
     * @param primaryKey The primary key to position the cursor at.
     * @returns The cursor after having been continued to the next or specified record.
     */
    continuePrimaryKey(
      key?: IDBKeyRange | IDBValidKey,
      primaryKey?: any
    ): Promise<Cursor>;
  }
}
