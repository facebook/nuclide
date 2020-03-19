// flow-typed signature: 2e415f033284600956b323d56d206449
// flow-typed version: b43dff3e0e/lru-cache_v4.0.x/flow_>=v0.20.0

declare module 'lru-cache' {
  declare type LRUCache<K, V> = {
    set: (key: K, value: V, maxAge?: number) => void,
    get: (key: K) => V,
    peek: (key: K) => V,
    del: (key: K) => void,
    reset: () => void,
    has: (key: K) => boolean,
    dump: () => Array<{k: K, v: V}>,
    load: (Array<{k: K, v: V}>) => void,
    itemCount: number,
    forEach: (
      handler: (value: V, key: K, cacheInstance: LRUCache<K, V>) => void,
      context?: LRUCache<K, V>,
    ) => void,
    // TODO add the rest of the things documented at https://www.npmjs.com/package/lru-cache
  };

  declare type Options<K, V> = {
    max?: number,
    maxAge?: number,
    length?: (value: V, key: K) => number,
    dispose?: (key: K, value: V) => void,
    stale?: boolean,
  };

  // TODO You can supply just an integer (max size), or even nothing at all.
  declare module.exports: <K, V>(options: Options<K, V>) => LRUCache<K, V>;
}
