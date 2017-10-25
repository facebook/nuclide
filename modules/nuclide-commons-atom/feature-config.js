/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/**
 * A wrapper over Atom's config functions for use with FeatureLoader.
 * Each individual loaded package's config is a subconfig of the root package.
 */

import invariant from 'assert';
import {Observable} from 'rxjs';

let packageName = null;

/**
 * Sets the root package name.
 * This gets automatically called from FeatureLoader.
 */
function setPackageName(name: string): void {
  packageName = name;
}

function getPackageName(): string {
  invariant(packageName != null, 'No package name available');
  return packageName;
}

function formatKeyPath(keyPath: string): string {
  if (packageName == null) {
    return keyPath;
  }
  return `${packageName}.${keyPath}`;
}

/*
 * Returns the value of a setting for a Nuclide feature key. Takes and returns the same types as
 * `atom.config.get` exception `keyPath` is not optional. To get the entire config object, use
 * `atom.config.get`.
 *
 * Note: This is intentionally typed as mixed, this way each call site has to
 * first cast it as any and it is obvious that this is an area that is not safe
 * and flow will not proceed if the callsite doesn't do it.
 *
 * Example:
 *   const config: MyConfigType = (featureConfig.get('config-name'): any);
 */
function get(
  keyPath: string,
  options?: {
    excludeSources?: Array<string>,
    sources?: Array<string>,
    scope?: Object,
  },
): mixed {
  // atom.config.get will crash if the second arg is present and undefined.
  // It does not crash if the second arg is missing.
  return atom.config.get(
    formatKeyPath(keyPath),
    ...(options == null ? [] : [options]),
  );
}

function getWithDefaults<T>(
  keyPath: string,
  defaults: T,
  options?: {
    excludeSources?: Array<string>,
    sources?: Array<string>,
    scope?: Object,
  },
): T {
  const current: any = get(keyPath, options);
  return current == null ? defaults : current;
}

/*
 * Gets the schema of a setting for a Nuclide feature key. Takes and returns the same types as
 * `atom.config.getSchema`.
 */
function getSchema(keyPath: string): atom$ConfigSchema {
  return atom.config.getSchema(formatKeyPath(keyPath));
}

/*
 * Similar to `atom.config.observe` except arguments are required, and options cannot be given.
 *
 * To observe changes on the entire config, use `atom.config.observe`.
 */
function observe(
  keyPath: string,
  callback: (value: any) => mixed,
): IDisposable {
  return atom.config.observe(formatKeyPath(keyPath), callback);
}

/*
 * Behaves similarly to the `observe` function, but returns a stream of values, rather
 * then receiving a callback.
 */
function observeAsStream(keyPath: string): Observable<mixed> {
  return Observable.create(observer => {
    const disposable = observe(keyPath, observer.next.bind(observer));
    return disposable.dispose.bind(disposable);
  });
}

/*
 * Takes and returns the same types as `atom.config.onDidChange` except `keyPath` is not optional.
 * To listen to changes on all key paths, use `atom.config.onDidChange`.
 */
function onDidChange(
  keyPath: string,
  optionsOrCallback: Object | ((event: Object) => void),
  callback?: (event: Object) => void,
): IDisposable {
  return atom.config.onDidChange(
    formatKeyPath(keyPath),
    ...Array.prototype.slice.call(arguments, 1),
  );
}

/*
 * Sets the value of a setting for a Nuclide feature key. Takes and returns the same types as
 * `atom.config.set`.
 */
function set(
  keyPath: string,
  value: ?mixed,
  options?: {
    scopeSelector?: string,
    source?: string,
  },
): boolean {
  return atom.config.set(
    formatKeyPath(keyPath),
    ...Array.prototype.slice.call(arguments, 1),
  );
}

/*
 * Sets the schema of a setting for a Nuclide feature key. Takes and returns the same types as
 * `atom.config.setSchema`.
 */
function setSchema(keyPath: string, schema: Object): void {
  return atom.config.setSchema(
    formatKeyPath(keyPath),
    ...Array.prototype.slice.call(arguments, 1),
  );
}

/*
 * Restores a setting for a Nuclide feature key to its default value. Takes and returns the same
 * types as `atom.config.set`.
 */
function unset(
  keyPath: string,
  options?: {
    scopeSelector?: string,
    source?: string,
  },
): void {
  return atom.config.unset(
    formatKeyPath(keyPath),
    ...Array.prototype.slice.call(arguments, 1),
  );
}

/**
 * Returns `true` if the feature with the given name is disabled either directly or because the
 * container package itself is disabled.
 */
function isFeatureDisabled(name: string): boolean {
  if (packageName == null) {
    return atom.packages.isPackageDisabled(name);
  }
  return (
    atom.packages.isPackageDisabled(packageName) ||
    !atom.config.get(`${packageName}.use.${name}`)
  );
}

export default {
  formatKeyPath,
  setPackageName,
  getPackageName,
  get,
  getWithDefaults,
  getSchema,
  observe,
  observeAsStream,
  onDidChange,
  set,
  setSchema,
  unset,
  isFeatureDisabled,
};
