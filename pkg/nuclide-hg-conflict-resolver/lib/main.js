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

import type {
  CheckoutSideName,
  MergeConflict,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RemoteDirectory} from '../../nuclide-remote-connection';

import {MercurialConflictDetector} from './MercurialConflictDetector';
import {onceGkInitialized, isGkEnabled} from '../../commons-node/passesGK';

let conflictDetector: ?MercurialConflictDetector;

export type RepositoryContext = {
  workingDirectory: atom$Directory | RemoteDirectory,
  priority: number,
  resolveText: string,

  readConflicts(): Promise<Array<MergeConflict>>,
  isResolvedFile(filePath: NuclideUri): Promise<boolean>,
  checkoutSide(sideName: CheckoutSideName, filePath: NuclideUri): Promise<void>,
  resolveFile(filePath: NuclideUri): Promise<void>,
  isRebasing(): boolean,
  complete(wasRebasing: boolean): void,
  quit(wasRebasing: boolean): void,
  joinPath(relativePath: string): NuclideUri,
};

export type ConflictsContextApi = {
  getContext(): Promise<?RepositoryContext>,
};

export type ConflictsApi = {
  registerContextApi(contextApi: ConflictsContextApi): void,
  showForContext(repositoryContext: RepositoryContext): void,
  hideForContext(repositoryContext: RepositoryContext): void,
};

export function activate() {}

export function deactivate() {
  if (conflictDetector != null) {
    conflictDetector.dispose();
    conflictDetector = null;
  }
}

export function consumeMergeConflictsApi(api: ConflictsApi) {
  onceGkInitialized(() => {
    if (!isGkEnabled('nuclide_conflict_resolver')) {
      conflictDetector = new MercurialConflictDetector();
      conflictDetector.setConflictsApi(api);
    }
  });
}
