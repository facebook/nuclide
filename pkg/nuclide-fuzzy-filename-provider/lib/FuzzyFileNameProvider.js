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
  FileResult,
  DirectoryProviderType,
} from '../../nuclide-quick-open/lib/types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {isGkEnabled} from 'nuclide-commons/passesGK';
import {
  RemoteDirectory,
  getFuzzyFileSearchServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import {getNuclideContext} from '../../commons-atom/ClientQueryContext';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

import {getIgnoredNames, parseFileNameQuery} from './utils';

const {logCustomFileSearchFeedback} = (function() {
  try {
    // $FlowFB
    return require('../../commons-atom/fb-custom-file-search-graphql');
  } catch (err) {
    return {};
  }
})();

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
    const {fileName, line, column} = parseFileNameQuery(query);
    if (fileName.length === 0) {
      return [];
    }

    const directoryPath = directory.getPath();
    const service = getFuzzyFileSearchServiceByNuclideUri(directoryPath);
    const preferCustomSearch = Boolean(
      isGkEnabled('nuclide_prefer_myles_search'),
    );
    const context = preferCustomSearch
      ? await getNuclideContext(directoryPath)
      : null;
    const results = await service.queryFuzzyFile({
      rootDirectory: directoryPath,
      queryRoot: getQueryRoot(directoryPath),
      queryString: fileName,
      ignoredNames: getIgnoredNames(),
      smartCase: Boolean(
        featureConfig.get('nuclide-fuzzy-filename-provider.smartCase'),
      ),
      preferCustomSearch,
      context,
    });

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

    return results.map(result => ({
      resultType: 'FILE',
      path: result.path,
      score: result.score,
      matchIndexes: result.matchIndexes,
      line,
      column,
      callback() {
        if (
          preferCustomSearch &&
          logCustomFileSearchFeedback &&
          context != null
        ) {
          logCustomFileSearchFeedback(
            result,
            results,
            query,
            directoryPath,
            context.session_id,
          );
        }
        // Custom callbacks need to run goToLocation
        goToLocation(result.path, {
          line,
          column,
        });
      },
    }));
  },
}: DirectoryProviderType<FileResult>);

// Returns the directory of the active text editor which will be used to unbreak
// ties when sorting the suggestions.
// TODO(T26559382) Extract to util function
function getQueryRoot(directoryPath: string): string | void {
  if (!isGkEnabled('nuclide_fuzzy_file_search_with_root_path')) {
    return undefined;
  }
  const editor = atom.workspace.getActiveTextEditor();
  const uri = editor ? editor.getURI() : null;

  return uri != null && nuclideUri.contains(directoryPath, uri)
    ? nuclideUri.dirname(uri)
    : undefined;
}
