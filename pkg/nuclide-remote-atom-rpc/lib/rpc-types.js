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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ConnectableObservable} from 'rxjs';

export type AtomFileEvent = 'open' | 'close';
export interface AtomCommands {
  openFile(
    filePath: NuclideUri,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>,
  openRemoteFile(
    uri: string,
    line: number,
    column: number,
    isWaiting: boolean,
  ): ConnectableObservable<AtomFileEvent>,
  addProject(projectPath: NuclideUri): Promise<void>,
  dispose(): void,
}

export type ConnectionDetails = {
  port: number,
  family: string,
};
