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

import type {DebugMode} from './types';

import consumeFirstProvider from '../../commons-atom/consumeFirstProvider';

// eslint-disable-next-line rulesdir/no-cross-atom-imports
import {LaunchProcessInfo} from '../../nuclide-debugger-php/lib/LaunchProcessInfo';
// eslint-disable-next-line rulesdir/no-cross-atom-imports
import {AttachProcessInfo} from '../../nuclide-debugger-php/lib/AttachProcessInfo';
import invariant from 'assert';

export async function debug(
  debugMode: DebugMode,
  activeProjectRoot: ?string,
  target: string,
  useTerminal: boolean,
  scriptArguments: string,
): Promise<void> {
  let processInfo = null;
  invariant(activeProjectRoot != null, 'Active project is null');

  // See if this is a custom debug mode type.
  try {
    // $FlowFB
    const helper = require('./fb-hhvm');
    processInfo = helper.getCustomLaunchInfo(
      debugMode,
      activeProjectRoot,
      target,
      scriptArguments,
    );
  } catch (e) {}

  if (processInfo == null) {
    if (debugMode === 'script') {
      processInfo = new LaunchProcessInfo(
        activeProjectRoot,
        target,
        null,
        useTerminal,
        scriptArguments,
      );
    } else {
      processInfo = new AttachProcessInfo(activeProjectRoot);
    }
  }

  // Use commands here to trigger package activation.
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'nuclide-debugger:show',
  );
  const debuggerService = await consumeFirstProvider('nuclide-debugger.remote');
  await debuggerService.startDebugging(processInfo);
}
