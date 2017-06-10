/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

export function arrayRemove<T>(array: Array<T>, element: T): void {
  const index = array.indexOf(element);
  if (index >= 0) {
    array.splice(index, 1);
  }
}

export function arrayEqual<T>(
  array1: Array<T>,
  array2: Array<T>,
  equalComparator?: (a: T, b: T) => boolean,
): boolean {
  if (array1.length !== array2.length) {
    return false;
  }
  const equalFunction = equalComparator || ((a: T, b: T) => a === b);
  return array1.every((item1, i) => equalFunction(item1, array2[i]));
}

/**
 * Returns a copy of the input Array with all `null` and `undefined` values filtered out.
 * Allows Flow to typecheck the common `filter(x => x != null)` pattern.
 */
export function arrayCompact<T>(array: Array<?T>): Array<T> {
  const result = [];
  for (const elem of array) {
    if (elem != null) {
      result.push(elem);
    }
  }
  return result;
}

/**
 * Flattens an Array<Array<T>> into just an Array<T>
 */
export function arrayFlatten<T>(array: Array<Array<T>>): Array<T> {
  const result = [];
  for (const subArray of array) {
    result.push(...subArray);
  }
  return result;
}

/**
 * Removes duplicates from Array<T>.
 * Uses SameValueZero for equality purposes, which is like '===' except it deems
 * two NaNs equal. http://www.ecma-international.org/ecma-262/6.0/#sec-samevaluezero
 */
export function arrayUnique<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}

/**
 * Returns the last index in the input array that matches the predicate.
 * Returns -1 if no match is found.
 */
export function arrayFindLastIndex<T>(
  array: Array<T>,
  predicate: (elem: T, index: number, array: Array<T>) => boolean,
  thisArg?: any,
): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (predicate.call(thisArg, array[i], i, array)) {
      return i;
    }
  }
  return -1;
}

/**
 * Merges a given arguments of maps into one Map, with the latest maps
 * overriding the values of the prior maps.
 */
export function mapUnion<T, X>(...maps: Array<Map<T, X>>): Map<T, X> {
  const unionMap = new Map();
  for (const map of maps) {
    for (const [key, value] of map) {
      unionMap.set(key, value);
    }
  }
  return unionMap;
}

export function mapFilter<T, X>(
  map: Map<T, X>,
  selector: (key: T, value: X) => boolean,
): Map<T, X> {
  const selected = new Map();
  for (const [key, value] of map) {
    if (selector(key, value)) {
      selected.set(key, value);
    }
  }
  return selected;
}

export function mapTransform<T, V1, V2>(
  src: Map<T, V1>,
  transform: (value: V1, key: T) => V2,
): Map<T, V2> {
  const result = new Map();
  for (const [key, value] of src) {
    result.set(key, transform(value, key));
  }
  return result;
}

export function mapEqual<T, X>(
  map1: Map<T, X>,
  map2: Map<T, X>,
  equalComparator?: (val1: X, val2: X, key1?: T, key2?: T) => boolean,
) {
  if (map1.size !== map2.size) {
    return false;
  }
  const equalFunction = equalComparator || ((a: X, b: X) => a === b);
  for (const [key1, value1] of map1) {
    if (!map2.has(key1) || !equalFunction(value1, (map2.get(key1): any))) {
      return false;
    }
  }
  return true;
}

export function mapGetWithDefault<K, V>(
  map: Map<K, V>,
  key: K,
  default_: V,
): V {
  if (map.has(key)) {
    // Cast through `any` since map.get's return is a maybe type. We can't just get the value and
    // check it against `null`, since null/undefined may inhabit V. We know this is safe since we
    // just checked that the map has the key.
    return (map.get(key): any);
  } else {
    return default_;
  }
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && every(a, element => b.has(element));
}

// Array.every but for any iterable.
export function every<T>(
  values: Iterable<T>,
  predicate: (element: T) => boolean,
): boolean {
  for (const element of values) {
    if (!predicate(element)) {
      return false;
    }
  }
  return true;
}

export function setIntersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set(Array.from(a).filter(e => b.has(e)));
}

export function setUnion<T>(a: Set<T>, b: Set<T>): Set<T> {
  // Avoids the extra Array allocations that `new Set([...a, ...b])` would incur. Some quick tests
  // indicate it would be about 60% slower.
  const result = new Set(a);
  b.forEach(x => {
    result.add(x);
  });
  return result;
}

export function setDifference<T>(
  a: Set<T>,
  b: Set<T>,
  hash_?: (v: T) => any,
): Set<T> {
  if (a.size === 0) {
    return new Set();
  } else if (b.size === 0) {
    return new Set(a);
  }
  const result = new Set();
  const hash = hash_ || (x => x);
  const bHashes = hash_ == null ? b : new Set(Array.from(b.values()).map(hash));
  a.forEach(value => {
    if (!bHashes.has(hash(value))) {
      result.add(value);
    }
  });
  return result;
}

/**
 * O(1)-check if a given object is empty (has no properties, inherited or not)
 */
export function isEmpty(obj: Object): boolean {
  for (const key in obj) {
    return false;
  }
  return true;
}

/**
 * Constructs an enumeration with keys equal to their value.
 * e.g. keyMirror({a: null, b: null}) => {a: 'a', b: 'b'}
 *
 * Based off the equivalent function in www.
 */
export function keyMirror<T: Object>(obj: T): {[key: $Enum<T>]: $Enum<T>} {
  const ret = {};
  Object.keys(obj).forEach(key => {
    ret[key] = key;
  });
  return ret;
}

/**
 * Given an array of [key, value] pairs, construct a map where the values for
 * each key are collected into an array of values, in order.
 */
export function collect<K, V>(pairs: Array<[K, V]>): Map<K, Array<V>> {
  const result = new Map();
  for (const pair of pairs) {
    const [k, v] = pair;
    let list = result.get(k);
    if (list == null) {
      list = [];
      result.set(k, list);
    }
    list.push(v);
  }
  return result;
}

export class MultiMap<K, V> {
  // Invariant: no empty sets. They should be removed instead.
  _map: Map<K, Set<V>>;

  // TODO may be worth defining a getter but no setter, to mimic Map. But please just behave and
  // don't mutate this from outside this class.
  //
  // Invariant: equal to the sum of the sizes of all the sets contained in this._map
  /* The total number of key-value bindings contained */
  size: number;

  constructor() {
    this._map = new Map();
    this.size = 0;
  }

  /*
   * Returns the set of values associated with the given key. Do not mutate the given set. Copy it
   * if you need to store it past the next operation on this MultiMap.
   */
  get(key: K): Set<V> {
    const set = this._map.get(key);
    if (set == null) {
      return new Set();
    }
    return set;
  }

  /*
   * Mimics the Map.prototype.set interface. Deliberately did not choose "set" as the name since the
   * implication is that it removes the previous binding.
   */
  add(key: K, value: V): MultiMap<K, V> {
    let set = this._map.get(key);
    if (set == null) {
      set = new Set();
      this._map.set(key, set);
    }
    if (!set.has(value)) {
      set.add(value);
      this.size++;
    }
    return this;
  }

  /*
   * Mimics the Map.prototype.set interface. Replaces the previous binding with new values.
   */
  set(key: K, values: Iterable<V>): void {
    this.deleteAll(key);
    const newSet = new Set(values);
    if (newSet.size !== 0) {
      this._map.set(key, newSet);
      this.size += newSet.size;
    }
  }

  /*
   * Deletes a single binding. Returns true iff the binding existed.
   */
  delete(key: K, value: V): boolean {
    const set = this.get(key);
    const didRemove = set.delete(value);
    if (set.size === 0) {
      this._map.delete(key);
    }
    if (didRemove) {
      this.size--;
    }
    return didRemove;
  }

  /*
   * Deletes all bindings associated with the given key. Returns true iff any bindings were deleted.
   */
  deleteAll(key: K): boolean {
    const set = this.get(key);
    this.size -= set.size;
    return this._map.delete(key);
  }

  clear(): void {
    this._map.clear();
    this.size = 0;
  }

  has(key: K, value: V): boolean {
    return this.get(key).has(value);
  }

  hasAny(key: K): boolean {
    return this._map.has(key);
  }

  *values(): Iterable<V> {
    for (const set of this._map.values()) {
      yield* set;
    }
  }

  forEach(callback: (value: V, key: K, obj: MultiMap<K, V>) => void): void {
    this._map.forEach((values, key) =>
      values.forEach(value => callback(value, key, this)),
    );
  }
}

export function objectEntries<T>(obj: {[key: string]: T}): Array<[string, T]> {
  if (obj == null) {
    throw new TypeError();
  }
  const entries = [];
  for (const key in obj) {
    if (
      obj.hasOwnProperty(key) &&
      Object.prototype.propertyIsEnumerable.call(obj, key)
    ) {
      entries.push([key, obj[key]]);
    }
  }
  return entries;
}

export function objectFromMap<T>(map: Map<string, T>): {[key: string]: T} {
  const obj = {};
  map.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

export function* concatIterators<T>(
  ...iterators: Array<Iterable<T>>
): Iterator<T> {
  for (const iterator of iterators) {
    for (const element of iterator) {
      yield element;
    }
  }
}

export function someOfIterable<T>(
  iterable: Iterable<T>,
  predicate: (element: T) => boolean,
): boolean {
  for (const element of iterable) {
    if (predicate(element)) {
      return true;
    }
  }
  return false;
}

export function findInIterable<T>(
  iterable: Iterable<T>,
  predicate: (element: T) => boolean,
): ?T {
  for (const element of iterable) {
    if (predicate(element)) {
      return element;
    }
  }
  return null;
}

export function* filterIterable<T>(
  iterable: Iterable<T>,
  predicate: (element: T) => boolean,
): Iterable<T> {
  for (const element of iterable) {
    if (predicate(element)) {
      yield element;
    }
  }
}

export function* mapIterable<T, M>(
  iterable: Iterable<T>,
  projectorFn: (element: T) => M,
): Iterable<M> {
  for (const element of iterable) {
    yield projectorFn(element);
  }
}

export function firstOfIterable<T>(iterable: Iterable<T>): ?T {
  return findInIterable(iterable, () => true);
}

export function iterableIsEmpty<T>(iterable: Iterable<T>): boolean {
  // eslint-disable-next-line no-unused-vars
  for (const element of iterable) {
    return false;
  }
  return true;
}

export function iterableContains<T>(iterable: Iterable<T>, value: T): boolean {
  return !iterableIsEmpty(
    filterIterable(iterable, element => element === value),
  );
}
