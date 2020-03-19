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

export type AtomCommands = {
  [target: string]: {
    [commandName: string]: atom$CommandListener,
  },
};

import {reconcileSets} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

type Projector<T> = (item: T) => AtomCommands;

/**
 * A utility that adds and removes commands to the Atom command registry based on their presence in
 * a stream. This is basically like a mini-React for Atom commands, however, instead of diffing the
 * result (commands), we diff the input (sets) since it's easier and less likely to contain
 * functions (which are unlikely to be able to be safely compared using `===`).
 */
export default function syncAtomCommands<T>(
  source: Observable<Set<T>>,
  project: Projector<T>,
  hash?: (v: T) => any,
): IDisposable {
  // Add empty sets before completing and erroring to make sure that we remove remaining commands
  // in both cases.
  const sets = source
    .concat(Observable.of(new Set()))
    .catch(err => Observable.of(new Set()).concat(Observable.throw(err)));

  return reconcileSets(
    sets,
    item => {
      const commands = project(item);
      const disposables = Object.keys(commands).map(target =>
        atom.commands.add(target, commands[target]),
      );
      return new UniversalDisposable(...disposables);
    },
    hash,
  );
}
