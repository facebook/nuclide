// flow-typed signature: 57ecb560d39f9264e4d18131dd961c8b
// flow-typed version: d679eeac2f/idb-keyval_v2.x.x/flow_>=v0.34.x

// Derived from TS typings at https://github.com/jakearchibald/idb-keyval/blob/b49b4e9fbf2f5deb63598f9cf0d9899d2f89dc95/typings.d.ts

declare module 'idb-keyval' {
  declare interface IDBKeyVal<Key> {
    /** Add a new value or update an existing one */
    set<Value>(key: Key, value: Value): Promise<void>,

    /** Get a value by key */
    get<Value>(key: Key): Promise<Value>,

    /** Get all keys in the database */
    keys(): Promise<Array<Key>>,

    /** Delete an entry in the database by key */
    delete(key: Key): Promise<void>,

    /** Delete all entries in the database */
    clear(): Promise<void>,
  }

  declare module.exports: IDBKeyVal<string>;
}
