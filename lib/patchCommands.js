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

import invariant from 'assert';
import semver from 'semver';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const INCLUDES_COMMAND_METADATA = '>= 1.21';

// TODO: (wbinnssmith) T22668678 remove when 1.21 is the minimum supported
// version of Atom
export default function patchCommands(): IDisposable {
  const disposable = new UniversalDisposable();
  if (semver.satisfies(atom.getVersion(), INCLUDES_COMMAND_METADATA)) {
    return disposable;
  }

  let disposed = false;
  disposable.add(() => (disposed = true));

  const originalAdd = atom.commands.add.bind(atom.commands);
  // $FlowFixMe We're patching intentionally :)
  atom.commands.add = function add(
    target: string | HTMLElement,
    commandNameOrCommands:
      | string
      | {[commandName: string]: atom$CommandListener},
    listener?: atom$CommandListener,
    throwOnInvalidSelector?: boolean = true,
  ) {
    if (disposed) {
      return originalAdd(...arguments);
    }

    if (typeof commandNameOrCommands === 'string') {
      invariant(listener != null);
      return originalAdd(
        target,
        commandNameOrCommands,
        listenerToCommandCallback(listener),
        throwOnInvalidSelector,
      );
    }

    const newMap = {};
    for (const key of Object.keys(commandNameOrCommands)) {
      newMap[key] = listenerToCommandCallback(commandNameOrCommands[key]);
    }

    return originalAdd(target, newMap, undefined, throwOnInvalidSelector);
  };

  return disposable;
}

function listenerToCommandCallback(
  listener: atom$CommandListener,
): atom$CommandCallback {
  return typeof listener === 'function' ? listener : listener.didDispatch;
}
