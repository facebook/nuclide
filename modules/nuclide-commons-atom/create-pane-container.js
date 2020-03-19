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

export default function createPaneContainer(): Object {
  const instance =
    typeof atom.workspace.getCenter === 'function'
      ? atom.workspace.getCenter().paneContainer
      : (atom.workspace: any).paneContainer;
  const PaneContainer = instance.constructor;
  return new PaneContainer({
    viewRegistry: atom.views,
    config: atom.config,
    applicationDelegate: atom.applicationDelegate,
    notificationManager: atom.notifications,
    deserializerManager: atom.deserializers,
  });
}
