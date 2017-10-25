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

import type {ServerConnection} from '..';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {RemoteDirectory} from '../lib/RemoteDirectory';
import {RemoteFile} from '../lib/RemoteFile';

const fsService = {
  ...fsPromise,
  async newFile(path) {
    return true;
  },
  async copy(src, dst) {
    await fsPromise.copy(src, dst);
    return true;
  },
  rmdir(uri) {
    return fsPromise.rimraf(nuclideUri.getPath(uri));
  },
  exists(uri) {
    return fsPromise.exists(nuclideUri.getPath(uri));
  },
  writeFileBuffer(path, buffer, options) {
    return fsPromise.writeFile(path, buffer, options);
  },
};

const connectionMock: ServerConnection & {getFsService(): Object} = ({
  getFsService: () => fsService,
  createDirectory: uri => new RemoteDirectory(connectionMock, uri),
  createFile: uri => new RemoteFile(connectionMock, uri),
  getRemoteConnectionForUri: () => null,
  getService: (serviceName: string) => {
    if (serviceName === 'FileSystemService') {
      return fsService;
    } else {
      throw new Error(`TODO: missing mock ${serviceName}`);
    }
  },
  getFileWatch: () => {
    throw new Error('mock me');
  },
  getDirectoryWatch: () => {
    throw new Error('mock me');
  },
}: any);

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = connectionMock;
