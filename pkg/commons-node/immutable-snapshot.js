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

import type {RecordFactory, RecordOf} from 'immutable';

import invariant from 'assert';
import Immutable from 'immutable';

// A snapshot of the Immutable.JS object represented by the ID "root".
// "root" may be represented as a 'delta' based on previously snapshotted objects,
// so this includes all of the objects that it depends on.
// Snapshots are intended to be JSON-serializable.
export type DeltaSnapshot = {|
  root: number,
  snapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
|};

// A snapshotted version of an individual immutable object.
// Every object is tagged with a unique ID.
type DeltaSnapshotImmutableObject =
  // "ref" means that the object has already been snapshotted -
  // either elsewhere in the current snapshot or in the previous snapshot.
  | {|
      type: 'ref',
      id: number,
    |}
  // "delta" means that the object should be derived from the value of `parentID`
  // after applying the mutations in `mutations`.
  | {|
      type: 'delta',
      id: number,
      parentID: number,
      mutations: Array<DeltaSnapshotMutation>,
    |}
  // If not 'ref' or 'delta', the entire object state is serialized.
  // Immutable.List
  | {|
      type: 'list',
      id: number,
      value: Array<DeltaSnapshotObject>,
    |}
  // Immutable.Map
  | {|
      type: 'map',
      id: number,
      // (key, value) pairs
      value: Array<[DeltaSnapshotObject, DeltaSnapshotObject]>,
    |}
  // Immutable.OrderedMap
  | {|
      type: 'orderedmap',
      id: number,
      // (key, value) pairs
      value: Array<[DeltaSnapshotObject, DeltaSnapshotObject]>,
    |}
  // Immutable.RecordOf
  | {|
      type: 'record',
      id: number,
      value: Array<[string, DeltaSnapshotObject]>,
    |};

// A more general representation of an object that can be either immutable or non-immutable.
type DeltaSnapshotObject =
  // To save space, primitives are serialized as is. (These never have typeof "object").
  | string
  | number
  | boolean
  | null
  | void
  // Regular JS objects need to be wrapped to differentiate from DeltaSnapshotImmutableObject.
  // NOTE: JSON-serializability of the snapshot depends on the serializability of these.
  // Nesting immutables in objects in immutables is not supported.
  | {|_: Object|}
  | DeltaSnapshotImmutableObject;

// Snapshotted mutation (note that the args may be other immutable objects.)
type DeltaSnapshotMutation = {|
  method: string,
  args: Array<DeltaSnapshotObject>,
|};

const UNWRAPPED_METHODS = new Set([
  'constructor',
  // Methods that are guaranteed not to cause a mutation.
  'get',
  'getIn',
  'first',
  'last',
  'reduce',
  'reduceRight',
  'find',
  'findLast',
  'findEntry',
  'findLastEntry',
  'max',
  'maxBy',
  'min',
  'minBy',
  // Covered by overriding __ensureOwner.
  'asMutable',
  'asImmutable',
  'withMutations',
]);

// A union of all Immutable collections that are currently supported.
export type DeltaSnapshotCollection =
  | Immutable.List<any>
  | Immutable.Map<any, any>
  | Immutable.OrderedMap<any, any>
  | RecordOf<any>;

/**
 * immutable-snapshot exports custom versions of Immutable collections that can record
 * mutations and the object they originated from.
 *
 * You can then periodically get a 'delta snapshot' of the state of Immutable objects
 * to get a JSON-serializable representation.
 * Once an object is snapshotted, any future mutations to the object are recorded, and
 * future 'delta snapshots' may use the mutations rather than the full contents of the object.
 *
 * The intended use case is for synchronizing Immutable state across e.g. process boundaries,
 * so that you don't have to send the entire object every time.
 * The receiver should use ImmutableSnapshotReader to turn snapshots back into Immutable objects.
 *
 * Usage example:
 *
 *   const snapshotter = new ImmutableSnapshot.ImmutableSnapshotter();
 *   let list = ImmutableSnapshot.List([1, 2, 3]);
 *   const snapshot = snapshotter.createDeltaSnapshot(list);
 *   // ... send snapshot somewhere else
 *   list = list.push(4).push(5);
 *   const snapshot2 = snapshotter.createDeltaSnapshot(list);
 *
 *   At this point snapshot2 only contains the values 4 and 5.
 *
 * On the other end we have:
 *
 *   const snapshotReader = new ImmutableSnapshotReader();
 *   // read snapshot from somewhere
 *   let list = snapshotReader.deserialize(snapshot);
 *   // read snapshot2 from somewhere
 *   list = snapshotReader.deserialize(snapshot2);
 *
 * IMPORTANT: It's assumed that any non-Immutable object anywhere in the snapshot
 * is JSON-serializable. (Otherwise, the result will not be JSON-serializable).
 */
export class ImmutableSnapshotter {
  // Track the contents of the previous snapshot so that we know what we can reuse.
  // Note that we could also store a complete history of snapshots on both sides,
  // but in practice patterns like Redux ensure that only the most recent state is really needed.
  _previousSnapshotObjects: ?{[id: number]: DeltaSnapshotImmutableObject};

  createDeltaSnapshot(object: DeltaSnapshotCollection): DeltaSnapshot {
    const snapshotObjects = {};
    const result = _snapshotImpl(
      object,
      snapshotObjects,
      this._previousSnapshotObjects || {},
    );
    invariant(
      result != null && typeof result.id === 'number',
      'Expected an immutable object as input',
    );
    this._previousSnapshotObjects = snapshotObjects;
    return {
      root: result.id,
      snapshotObjects,
    };
  }
}

export function List<T>(value?: Iterable<T>): Immutable.List<T> {
  // Use a custom prototype to override methods for tracking purposes.
  return _wrap(Immutable.List(value), List);
}

List.prototype = Object.create(Immutable.List.prototype);
List.of = (...args) => List(args);
_overrideMethods(List, Immutable.List);

function SnapshotMap<K, V>(
  value?: Iterable<[K, V]> | {[key: K]: V},
): Immutable.Map<K, V> {
  return _wrap(Immutable.Map(value), SnapshotMap);
}

SnapshotMap.prototype = Object.create(Immutable.Map.prototype);
// $FlowIssue: Map.of is missing
SnapshotMap.of = (...args) => SnapshotMap(Immutable.Map.of(...args));
_overrideMethods(SnapshotMap, Immutable.Map);
export {SnapshotMap as Map};

export function OrderedMap<K, V>(
  value?: Iterable<[K, V]> | {[key: K]: V},
): Immutable.OrderedMap<K, V> {
  return _wrap(Immutable.OrderedMap(value), OrderedMap);
}

OrderedMap.prototype = Object.create(Immutable.OrderedMap.prototype);
_overrideMethods(OrderedMap, Immutable.OrderedMap);

// Immutable.Record actually returns a RecordFactory which then produces RecordInstances.
export function Record<T: Object>(value: T): RecordFactory<T> {
  const OriginalRecord = Immutable.Record(value);
  class DiffableRecord extends OriginalRecord {}
  _overrideMethods(DiffableRecord, OriginalRecord);
  return DiffableRecord;
}

// Immutable.JS does not correctly support inheritance :(
// We often need to manually re-wrap the objects.
function _wrap(object: Object, constructor: Function) {
  if (object.size === 0) {
    // Immutable.JS shares empty objects, so we can't mutate these.
    // TODO: implement our own shared empty objects.
    return Object.assign(Object.create(constructor.prototype), object);
  }
  // Though setPrototypeOf has performance concerns, benchmarking shows that
  // this is still much faster than the object creation & assignment above.
  return Object.setPrototypeOf(object, constructor.prototype);
}

// Private symbol to store metadata on objects.
// (This is much faster than using a WeakMap.)
const MetadataKey = Symbol('Metadata');

type Metadata = {|
  // A guaranteed unique ID for the object.
  id: number,
  // Records the source of each immutable object, along with the mutations applied.
  parent?: DeltaSnapshotCollection,
  mutations?: Array<{
    method: string,
    args: Array<any>,
  }>,
  // We track all objects ever snapshotted for an optimization:
  // There's no point in tracking mutations to newly-created objects not in the snapshot.
  // For new objects, the serialized list of mutations almost certainly takes more space
  // than its raw JSON representation.
  // Ideally this would be tied to a particular ImmutableSnapshotter for accuracy,
  // but we make a tradeoff here to keep the actual collections global.
  // (In practice objects not in the previous snapshot are unlikely to be used again.)
  snapshotted?: boolean,
|};

// Generates a unique auto-incrementing ID for any object.
let _objectCount: number = 0;

function _getMetadata(object: Object): Metadata {
  let metadata = object[MetadataKey];
  if (metadata == null) {
    metadata = {id: ++_objectCount};
    object[MetadataKey] = metadata;
  }
  return metadata;
}

function _snapshotImpl(
  object: Object,
  snapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
  previousSnapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
): DeltaSnapshotObject {
  // Primitives
  if (typeof object !== 'object') {
    return object;
  }

  // Regular JS objects
  if (!Immutable.isImmutable(object)) {
    return {_: object};
  }

  const metadata = _getMetadata(object);
  const {id, parent, mutations} = metadata;
  // If this was already snapshotted last time (or earlier in the current snapshot),
  // assume the deserializer still knows about it.
  if (previousSnapshotObjects[id] != null || snapshotObjects[id] != null) {
    return (snapshotObjects[id] = {type: 'ref', id});
  }
  metadata.snapshotted = true;

  if (parent != null) {
    invariant(mutations != null);
    const parentSnapshot = _snapshotImpl(
      parent,
      snapshotObjects,
      previousSnapshotObjects,
    );
    invariant(
      parentSnapshot != null && typeof parentSnapshot.id === 'number',
      'Parent must be immutable',
    );
    return (snapshotObjects[id] = {
      type: 'delta',
      id,
      parentID: parentSnapshot.id,
      mutations: mutations.map(mutation => {
        return {
          method: mutation.method,
          // Mutation arguments may be other immutable objects, so snapshot those too.
          args: mutation.args.map(arg =>
            _snapshotImpl(arg, snapshotObjects, previousSnapshotObjects),
          ),
        };
      }),
    });
  } else if (object instanceof Immutable.List) {
    return (snapshotObjects[id] = {
      type: 'list',
      id,
      value: object.toJSON().map(x =>
        // Nested immutable objects are well-supported.
        _snapshotImpl(x, snapshotObjects, previousSnapshotObjects),
      ),
    });
  } else if (object instanceof Immutable.OrderedMap) {
    const value = [];
    for (const [k, v] of object.entries()) {
      value.push([
        _snapshotImpl(k, snapshotObjects, previousSnapshotObjects),
        _snapshotImpl(v, snapshotObjects, previousSnapshotObjects),
      ]);
    }
    return (snapshotObjects[id] = {type: 'orderedmap', id, value});
  } else if (object instanceof Immutable.Map) {
    const value = [];
    for (const [k, v] of object.entries()) {
      value.push([
        _snapshotImpl(k, snapshotObjects, previousSnapshotObjects),
        _snapshotImpl(v, snapshotObjects, previousSnapshotObjects),
      ]);
    }
    return (snapshotObjects[id] = {type: 'map', id, value});
  } else if (object instanceof Immutable.Record) {
    const value = [];
    for (const [k, v] of object.entries()) {
      value.push([
        k,
        _snapshotImpl(v, snapshotObjects, previousSnapshotObjects),
      ]);
    }
    return (snapshotObjects[id] = {type: 'record', id, value});
  } else {
    throw new Error(
      `Serialization for ${object.constructor.name} is not implemented yet.`,
    );
  }
}

/**
 * The core idea here is to wrap all 'mutation' methods of immutable objects.
 * Since Immutable.JS returns a new object on change, we can record that
 * the new object descended from the initial object and also record the mutation.
 * These can then be replayed in ImmutableSnapshotReader.
 */
function _overrideMethods(wrapped: Function, original: Function): void {
  const originalPrototype = original.prototype;

  // Storing the call depth allows us to discard mutations triggered within mutations
  // (e.g. List.push uses List.set underneath.)
  let depth = 0;

  function wrapIfNeeded(object: Object): Object {
    if (object == null || typeof object !== 'object') {
      return object;
    }
    // Strictly check equality to prevent wrapping subclasses of 'original'
    // (e.g. Immutable.Map.sort returns an Immutable.OrderedMap, which we can't wrap here.)
    const proto = Object.getPrototypeOf(object);
    if (proto === originalPrototype) {
      return _wrap(object, wrapped);
      // $FlowIssue: OrderedMap.prototype should exist
    } else if (proto === Immutable.OrderedMap.prototype) {
      // Immutable.Map.sort returns an OrderedMap.
      // This won't be recorded as a mutation, but continue wrapping it.
      return _wrap(object, OrderedMap);
    }
    return object;
  }

  for (const method in originalPrototype) {
    if (
      method.startsWith('__') ||
      method.startsWith('to') ||
      method.startsWith('@@') ||
      UNWRAPPED_METHODS.has(method)
    ) {
      continue;
    }
    const oldMethod = wrapped.prototype[method];
    wrapped.prototype[method] = function(...args) {
      // Don't record nested mutations.
      if (depth) {
        return wrapIfNeeded(oldMethod.apply(this, args));
      }
      depth++;
      let newObject = oldMethod.apply(this, args);
      depth--;
      if (newObject !== this) {
        newObject = wrapIfNeeded(newObject);
        // Only record a mutation if wrapping was successful.
        if (
          newObject instanceof wrapped &&
          _isSerializable(args) &&
          _shouldRecordMutations(this)
        ) {
          const metadata = _getMetadata(newObject);
          invariant(
            metadata.parent == null,
            'An object cannot have two parents',
          );
          metadata.parent = this;
          metadata.mutations = [{method, args}];
        }
      } else if (this.__ownerID) {
        // this.__ownerID indicates that the object is currently mutable.
        // We'll push these mutations onto the existing parent record.
        // (generated from the __ensureOwner override below).
        const {mutations} = _getMetadata(newObject);
        if (mutations != null) {
          // Note: withMutations only supports certain mutations.
          // All of them should be serializable (e.g. set, push, pop)
          mutations.push({method, args});
        }
      }
      return newObject;
    };
  }

  // __ensureOwner is what Immutable.JS uses to implement asMutable().
  // It creates a copy of the object, so we need to record the parent.
  const {__ensureOwner} = wrapped.prototype;
  wrapped.prototype.__ensureOwner = function(ownerID) {
    let newObject = __ensureOwner.call(this, ownerID);
    // Some methods use `withMutation` in their implementation. Ignore it.
    if (depth) {
      return newObject;
    }
    if (newObject !== this) {
      if (!(newObject instanceof wrapped)) {
        newObject = _wrap(newObject, wrapped);
      }
      if (_shouldRecordMutations(this)) {
        const metadata = _getMetadata(newObject);
        invariant(metadata.parent == null, 'An object cannot have two parents');
        metadata.parent = this;
        metadata.mutations = [];
      }
    }
    return newObject;
  };
}

function _isSerializable(args: Array<mixed>): boolean {
  // Mutations with functions as arguments are not serializable.
  return args.every(x => typeof x !== 'function');
}

function _shouldRecordMutations(object: DeltaSnapshotCollection): boolean {
  // It's not worth recording mutations to empty collections.
  if (object.size === 0) {
    return false;
  }
  const {parent, snapshotted} = _getMetadata(object);
  return parent != null || snapshotted != null;
}

/**
 * ImmutableSnapshotReader is stateful because it needs to keep the previous snapshot around.
 * Note that any values used in snapshots before that will be discarded - so it's important that
 * ImmutableSnapshotReader and its corresponding ImmutableSnapshotter stay in sync.
 */
export class ImmutableSnapshotReader {
  // Since ImmutableSnapshotter uses the previous snapshot to create deltas,
  // we must also keep the deserialized version of the last snapshot around.
  _previousDeserializedObjects: Map<
    number,
    DeltaSnapshotCollection,
  > = new Map();

  readSnapshot({
    root,
    snapshotObjects,
  }: DeltaSnapshot): DeltaSnapshotCollection {
    const deserializedObjects = new Map();
    const result = this._deserializeImmutable(
      root,
      snapshotObjects,
      deserializedObjects,
    );
    // Keep the last snapshot around for the next snapshot to use.
    this._previousDeserializedObjects = deserializedObjects;
    return result;
  }

  _deserializeObject(
    object: DeltaSnapshotObject,
    snapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
    deserializedObjects: Map<number, DeltaSnapshotCollection>,
  ): mixed {
    if (object == null || typeof object !== 'object') {
      return object;
    }
    if (object.id == null) {
      // $FlowIssue: this is guaranteed to exist
      return object._;
    }
    return this._deserializeImmutable(
      object.id,
      snapshotObjects,
      deserializedObjects,
    );
  }

  _deserializeImmutable(
    id: number,
    snapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
    deserializedObjects: Map<number, DeltaSnapshotCollection>,
  ): DeltaSnapshotCollection {
    const object = snapshotObjects[id];
    invariant(object != null, `Missing record for id ${id}`);
    switch (object.type) {
      case 'ref':
        const stored =
          this._previousDeserializedObjects.get(object.id) ||
          deserializedObjects.get(object.id);
        invariant(
          stored != null,
          `Expected ${object.id} to be previously snapshotted`,
        );
        deserializedObjects.set(object.id, stored);
        return stored;
      case 'delta':
        const parent = this._deserializeImmutable(
          object.parentID,
          snapshotObjects,
          deserializedObjects,
        );
        invariant(
          Immutable.isImmutable(parent),
          'Expected parent to be an immutable object',
        );
        let value;
        // withMutations doesn't support all mutations, so we must handle the singular case.
        if (object.mutations.length === 1) {
          value = this._applyMutation(
            parent,
            object.mutations[0],
            snapshotObjects,
            deserializedObjects,
          );
        } else {
          value = parent.withMutations(p => {
            object.mutations.forEach(mutation => {
              this._applyMutation(
                p,
                mutation,
                snapshotObjects,
                deserializedObjects,
              );
            });
          });
        }
        deserializedObjects.set(object.id, value);
        return value;
      case 'list':
        const list = Immutable.List(
          object.value.map(elem =>
            this._deserializeObject(elem, snapshotObjects, deserializedObjects),
          ),
        );
        deserializedObjects.set(object.id, list);
        return list;
      case 'map':
        const map = Immutable.Map(
          object.value.map(([k, v]) => [
            this._deserializeObject(k, snapshotObjects, deserializedObjects),
            this._deserializeObject(v, snapshotObjects, deserializedObjects),
          ]),
        );
        deserializedObjects.set(object.id, map);
        return map;
      case 'orderedmap':
        const orderedMap = Immutable.OrderedMap(
          object.value.map(([k, v]) => [
            this._deserializeObject(k, snapshotObjects, deserializedObjects),
            this._deserializeObject(v, snapshotObjects, deserializedObjects),
          ]),
        );
        deserializedObjects.set(object.id, orderedMap);
        return orderedMap;
      case 'record':
        const record = {};
        object.value.forEach(([k, v]) => {
          record[k] = this._deserializeObject(
            v,
            snapshotObjects,
            deserializedObjects,
          );
        });
        class _Record extends Immutable.Record(record) {}
        const rec = new _Record(record);
        deserializedObjects.set(object.id, rec);
        return rec;
      default:
        (object.type: empty);
        throw new Error(`Unexpected type ${object.type}`);
    }
  }

  _applyMutation(
    object: Object,
    mutation: DeltaSnapshotMutation,
    snapshotObjects: {[id: number]: DeltaSnapshotImmutableObject},
    deserializedObjects: Map<number, DeltaSnapshotCollection>,
  ): DeltaSnapshotCollection {
    const args = mutation.args.map(arg =>
      this._deserializeObject(arg, snapshotObjects, deserializedObjects),
    );
    return object[mutation.method](...args);
  }
}
