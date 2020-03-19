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

import createPackage from 'nuclide-commons-atom/createPackage';
import RecentFilesService from './RecentFilesService';

export type FilePath = string;
export type TimeStamp = number;
export type FileList = Array<{path: FilePath, timestamp: TimeStamp}>;
export type RecentFilesSerializedState = {filelist?: FileList};

class Activation {
  _service: RecentFilesService;

  constructor() {
    this._service = new RecentFilesService();
  }

  provideRecentFilesService(): RecentFilesService {
    return this._service;
  }

  dispose() {
    this._service.dispose();
  }
}

createPackage(module.exports, Activation);
