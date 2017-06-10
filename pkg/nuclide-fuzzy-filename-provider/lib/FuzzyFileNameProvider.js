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

import type {FileResult, Provider} from '../../nuclide-quick-open/lib/types';

import {
  RemoteDirectory,
  getFuzzyFileSearchServiceByNuclideUri,
} from '../../nuclide-remote-connection';

import {getIgnoredNames} from './utils';

export default ({
  providerType: 'DIRECTORY',
  name: 'FuzzyFileNameProvider',
  debounceDelay: 0,
  display: {
    title: 'Filenames',
    prompt: 'Fuzzy filename search...',
    action: 'nuclide-fuzzy-filename-provider:toggle-provider',
  },
  // Give preference to filename results in OmniSearch.
  priority: 1,

  isEligibleForDirectory(directory: atom$Directory): Promise<boolean> {
    return directory.exists();
  },

  async executeQuery(
    query: string,
    directory: atom$Directory,
  ): Promise<Array<FileResult>> {
    if (query.length === 0) {
      return [];
    }

    const directoryPath = directory.getPath();
    const service = getFuzzyFileSearchServiceByNuclideUri(directoryPath);
    const results = await service.queryFuzzyFile(
      directoryPath,
      query,
      getIgnoredNames(),
    );

    // Take the `nuclide://<host>` prefix into account for matchIndexes of remote files.
    if (RemoteDirectory.isRemoteDirectory(directory)) {
      const remoteDir: RemoteDirectory = (directory: any);
      const indexOffset =
        directoryPath.length - remoteDir.getLocalPath().length;
      for (let i = 0; i < results.length; i++) {
        for (let j = 0; j < results[i].matchIndexes.length; j++) {
          results[i].matchIndexes[j] += indexOffset;
        }
      }
    }

    return ((results: any): Array<FileResult>);
  },
}: Provider);
