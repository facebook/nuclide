/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {
  SuggestedProjectPath,
  DebuggerSourcePathsService,
} from 'atom-ide-debugger-java/types';

import {observeProjectPathsAll} from 'nuclide-commons-atom/projects';

export function observeProjectPathsAllFromSourcePathsService(
  callback: (Array<SuggestedProjectPath>) => void,
) {
  let _sourcePathsService: ?DebuggerSourcePathsService;
  atom.packages.serviceHub
    .consume('debugger.sourcePaths', '0.0.0', provider => {
      _sourcePathsService = provider;
    })
    .dispose();
  return _sourcePathsService != null
    ? _sourcePathsService.observeSuggestedAndroidProjectPaths(callback)
    : observeProjectPathsAll(projectPaths => {
        callback(
          projectPaths.map(projectPath => {
            return {
              projectPath,
              suggested: true,
              hostLabel: projectPath,
            };
          }),
        );
      });
}
