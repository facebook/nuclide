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

import * as React from 'react';

import type {FileResult} from '../../nuclide-quick-open/lib/types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';

import HighlightedText from 'nuclide-commons-ui/HighlightedText';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';
import {Matcher} from 'nuclide-fuzzy-native';
import {BehaviorSubject, Observable} from 'rxjs';
import FileFamilyAggregator from './FileFamilyAggregator';

import nullthrows from 'nullthrows';
import matchIndexesToRanges from 'nuclide-commons/matchIndexesToRanges';

const ErrorCodes = Object.freeze({
  NO_ACTIVE_FILE: 'NO_ACTIVE_FILE',
});

export type RelatedFileResult = FileResult & {
  pathWithoutRoot?: ?string,
  labels?: Set<string>,
  exists?: boolean,
  creatable?: boolean,
  errorCode?: $Keys<typeof ErrorCodes>,
  labelHeader?: string,
};

function groupFilesByLabel(files: Array<RelatedFileResult>) {
  const labelGroups: Map<string, Array<RelatedFileResult>> = new Map();
  labelGroups.set('unlabeled', []);

  files.forEach(file => {
    if (file.labels == null || file.labels.size === 0) {
      nullthrows(labelGroups.get('unlabeled')).push(file);
    } else {
      file.labels.forEach(label => {
        if (labelGroups.has(label)) {
          nullthrows(labelGroups.get(label)).push(file);
        } else {
          labelGroups.set(label, [file]);
        }
      });
    }
  });

  const groupedFiles = [];
  labelGroups.forEach((labelledFiles, label) => {
    groupedFiles.push(
      ...labelledFiles
        // Have existing files come before non-existing files with Create File
        // options.
        .sort(
          (a, b) =>
            !a.exists && b.exists ? 1 : a.exists && !b.exists ? -1 : 0,
        )
        .map((file, i) => {
          // Add header for the first file in the label group
          if (i === 0) {
            file.labelHeader = label;
          }
          return file;
        }),
    );
  });

  return groupedFiles;
}

class FileFamilyQuickOpenProvider {
  providerType = 'GLOBAL';
  name = 'FileFamilyQuickOpenProvider';
  debounceDelay = 0;
  display = {
    title: 'Related Files',
    prompt: 'Search file names of related files...',
    action: 'nuclide-file-family-quick-open-provider:toggle-provider',
  };

  _aggregators: BehaviorSubject<?FileFamilyAggregator>;
  _cwds: BehaviorSubject<?CwdApi>;

  constructor(
    aggregators: BehaviorSubject<?FileFamilyAggregator>,
    cwds: BehaviorSubject<?CwdApi>,
  ): void {
    this._aggregators = aggregators;
    this._cwds = cwds;
  }

  async isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean> {
    return true;
  }

  executeQuery(
    query: string,
    directories: Array<atom$Directory>,
  ): Promise<Array<RelatedFileResult>> {
    const aggregator = this._aggregators.getValue();
    if (aggregator == null) {
      return Promise.resolve([]);
    }

    const activeEditor = atom.workspace.getActiveTextEditor();
    const activeUri = activeEditor && activeEditor.getURI();

    if (activeUri == null) {
      return Promise.resolve([
        {
          resultType: 'FILE',
          path: '',
          errorCode: ErrorCodes.NO_ACTIVE_FILE,
        },
      ]);
    }

    const results = Observable.defer(() =>
      aggregator.getRelatedFiles(activeUri),
    )
      .map(graph => {
        const cwd = this._cwds.getValue();
        const projectUri = cwd && cwd.getCwd();

        const files = Array.from(graph.files)
          .map(([uri, file]) => ({
            path: uri,
            pathWithoutRoot:
              projectUri == null ? uri : `.${uri.replace(projectUri, '')}`,
            ...file,
          }))
          .filter(file => file.path !== activeUri);

        const matcher = new Matcher(files.map(file => file.pathWithoutRoot));

        return groupFilesByLabel(
          matcher.match(query, {recordMatchIndexes: true}).map((result, i) => {
            const file = files.find(f => f.pathWithoutRoot === result.value);

            return {
              resultType: 'FILE',
              score: file && file.exists ? result.score * 10 : result.score,
              matchIndexes: result.matchIndexes,
              ...file,
            };
          }),
        );
      })
      .toPromise();

    return results;
  }

  getComponentForItem(item: RelatedFileResult): React.Element<any> {
    // Special paths indicate that an error occurred.
    switch (item.errorCode) {
      case ErrorCodes.NO_ACTIVE_FILE:
        return (
          <div>
            <span className="file icon icon-file">
              Open a file to retrieve alternates for it.
            </span>
          </div>
        );
    }

    const matchIndexes = item.matchIndexes || [];
    const path = item.pathWithoutRoot == null ? '' : item.pathWithoutRoot;

    return (
      <div>
        {item.labelHeader != null && (
          <div className="nuclide-file-family-quick-open-provider-file-label-header">
            {item.labelHeader}
          </div>
        )}
        <div
          className="nuclide-file-family-quick-open-provider-result"
          style={{opacity: item.exists ? 1 : 0.5}}>
          <PathWithFileIcon
            className="nuclide-file-family-quick-open-provider-file-path"
            path={path}>
            <HighlightedText
              highlightedRanges={matchIndexesToRanges(matchIndexes)}
              text={path}
            />
          </PathWithFileIcon>
          {!item.exists && (
            <div className="nuclide-file-family-quick-open-provider-create-file-container">
              <span className="nuclide-file-family-quick-open-provider-create-file-label">
                Create File
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default FileFamilyQuickOpenProvider;
