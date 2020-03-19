/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import {Emitter} from 'event-kit';

export type WatchmanSubscriptionOptions = {
  expression: ?Array<string>, // e.g. ['match', '*.js'],
  fields?: Array<string>, // e.g. ['name', 'size', 'exists', 'mode']
  expression?: Array<mixed>, // e.g. ['dirname', relativePath]
  since?: string, // e.g. "c:1439492655:58601:1:14195"
  defer_vcs?: boolean,

  /**
   * For performance reasons, prefer:
   *
   *     "relative_root": "relative/path"
   *
   * over:
   *
   *     "expression": ["dirname", "relative/path"]
   */
  relative_root?: string,

  /** If true, no files will be returned for fresh instances. */
  empty_on_fresh_instance?: boolean,
};

/**
 * @param pathFromSubscriptionRootToSubscriptionPath The relative path from
 *   subscriptionRoot to subscriptionPath. This is the 'relative_path' as described at
 *   https://facebook.github.io/watchman/docs/cmd/watch-project.html#using-watch-project.
 *   Notably, this value should be undefined if subscriptionRoot is the same as
 *   subscriptionPath.
 */
export default class WatchmanSubscription extends Emitter {
  subscriptionCount: number;
  root: string;
  path: string;
  pathFromSubscriptionRootToSubscriptionPath: ?string;
  name: string;
  options: WatchmanSubscriptionOptions;
  constructor(
    subscriptionRoot: string,
    pathFromSubscriptionRootToSubscriptionPath: ?string,
    subscriptionPath: string,
    subscriptionName: string,
    subscriptionCount: number,
    subscriptionOptions: WatchmanSubscriptionOptions,
  ) {
    super();
    this.root = subscriptionRoot;
    this.pathFromSubscriptionRootToSubscriptionPath = pathFromSubscriptionRootToSubscriptionPath;
    this.path = subscriptionPath;
    this.name = subscriptionName;
    this.subscriptionCount = subscriptionCount;
    this.options = subscriptionOptions;
  }
}
