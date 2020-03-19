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

import type {ConnectableObservable} from 'rxjs';
import type {VSAdapterExecutableInfo, VsAdapterType} from './types';
import type {ProcessInfo, ProcessMessage} from 'nuclide-commons/process';

import {psTree} from 'nuclide-commons/process';
import VsAdapterSpawner from './VsAdapterSpawner';
import {getAdapterExecutable} from './debugger-registry';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {getAbsoluteBinaryPathForPid} from 'nuclide-commons/process';

export class VsRawAdapterSpawnerService extends VsAdapterSpawner {
  spawnAdapter(
    adapter: VSAdapterExecutableInfo,
  ): ConnectableObservable<ProcessMessage> {
    return super.spawnAdapter(adapter);
  }

  write(input: string): Promise<void> {
    return super.write(input);
  }

  dispose(): Promise<void> {
    return super.dispose();
  }
}

export async function createVsRawAdapterSpawnerService(): Promise<
  VsRawAdapterSpawnerService,
> {
  return new VsRawAdapterSpawnerService();
}

export async function getProcessTree(): Promise<Array<ProcessInfo>> {
  return psTree();
}

export async function getBuckRootFromUri(uri: string): Promise<?string> {
  if (!nuclideUri.isAbsolute(uri)) {
    return null;
  }
  let path = uri;

  while (true) {
    const rootTest = nuclideUri.join(path, '.buckconfig');
    // eslint-disable-next-line no-await-in-loop
    if (await fsPromise.exists(rootTest)) {
      return path;
    }
    const newPath = nuclideUri.getParent(path);
    if (newPath === path) {
      break;
    }

    path = newPath;
  }

  return null;
}

export async function getBuckRootFromPid(pid: number): Promise<?string> {
  const path = await getAbsoluteBinaryPathForPid(pid);
  if (path == null) {
    return null;
  }

  return getBuckRootFromUri(path);
}

export async function realpath(path: string): Promise<string> {
  return fsPromise.realpath(path);
}

export async function exists(path: string): Promise<boolean> {
  return fsPromise.exists(path);
}

export async function getAdapterExecutableInfo(
  adapterType: VsAdapterType,
): Promise<VSAdapterExecutableInfo> {
  return getAdapterExecutable(adapterType);
}
