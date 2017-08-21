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

import nuclideUri from 'nuclide-commons/nuclideUri';
import React from 'react';

import type {FileResult, Provider} from '../../nuclide-quick-open/lib/types';

import {arrayCompact} from 'nuclide-commons/collection';
import {relativeDate} from 'nuclide-commons/string';
import {Matcher} from '../../nuclide-fuzzy-native';
import PathWithFileIcon from '../../nuclide-ui/PathWithFileIcon';

// Imported from nuclide-files-service, which is an apm package, preventing a direct import.
type FilePath = string;
type TimeStamp = number;
type FileList = Array<{path: FilePath, timestamp: TimeStamp}>;
type RecentFilesService = {
  getRecentFiles(): FileList,
  touchFile(path: string): void,
};

let _recentFilesService: ?RecentFilesService = null;

function getRecentFilesMatching(query: string): Array<FileResult> {
  if (_recentFilesService == null) {
    return [];
  }
  const projectPaths = atom.project.getPaths();
  const openFiles = new Set(
    arrayCompact(
      atom.workspace.getTextEditors().map(editor => editor.getPath()),
    ),
  );
  const validRecentFiles = _recentFilesService
    .getRecentFiles()
    .filter(
      result =>
        !openFiles.has(result.path) &&
        projectPaths.some(
          projectPath => result.path.indexOf(projectPath) !== -1,
        ),
    );
  const timestamps: Map<FilePath, TimeStamp> = new Map();
  const matcher = new Matcher(
    validRecentFiles.map(recentFile => {
      timestamps.set(recentFile.path, recentFile.timestamp);
      return recentFile.path;
    }),
  );
  return (
    matcher
      .match(query, {recordMatchIndexes: true})
      .map(result => ({
        path: result.value,
        score: result.score,
        matchIndexes: result.matchIndexes,
        timestamp: timestamps.get(result.value) || 0,
      }))
      // $FlowIssue Flow seems to type the arguments to `sort` as `FileResult` without `timestamp`.
      .sort((a, b) => b.timestamp - a.timestamp)
  );
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MIN_OPACITY = 0.6;
const SHELF = 8 * MS_PER_HOUR; // 8 hours: heuristic for "current work day".
const FALLOFF = 1.1;
/**
 * Calculate opacity with logarithmic falloff based on recency of the timestamp.
 *
 *  Opacity                     now
 *  ^                           |
 *  |                  < SHELF >
 *  |                  #########
 *  |                  #########
 *  |   < FALLOFF >  ###########
 *  |               ############
 *  |            ###############
 *  |        ###################
 *  | ##########################  ] MIN_OPACITY
 *  | ##########################  ]
 *  +----------Time-------------->
 */
function opacityForTimestamp(timestamp: number): number {
  const ageInMS = Date.now() - timestamp;
  return Math.min(
    1,
    Math.max(
      1 - FALLOFF * Math.log10((ageInMS - SHELF) / MS_PER_DAY + 1),
      MIN_OPACITY,
    ),
  );
}

export const RecentFilesProvider: Provider = {
  providerType: 'GLOBAL',
  name: 'RecentFilesProvider',
  debounceDelay: 0,
  display: {
    title: 'Recent Files',
    prompt: 'Search recently opened filenames...',
    action: 'nuclide-recent-files-provider:toggle-provider',
  },

  async isEligibleForDirectories(
    directories: Array<atom$Directory>,
  ): Promise<boolean> {
    return true;
  },

  executeQuery(
    query: string,
    directories: Array<atom$Directory>,
  ): Promise<Array<FileResult>> {
    return Promise.resolve(getRecentFilesMatching(query));
  },

  getComponentForItem(item: FileResult): React.Element<any> {
    const filename = nuclideUri.basename(item.path);
    const filePath = item.path.substring(0, item.path.lastIndexOf(filename));
    const date = item.timestamp == null ? null : new Date(item.timestamp);
    const datetime = date === null ? '' : date.toLocaleString();
    return (
      <div
        className="recent-files-provider-result"
        // flowlint-next-line sketchy-null-number:off
        style={{opacity: opacityForTimestamp(item.timestamp || Date.now())}}
        title={datetime}>
        <div className="recent-files-provider-filepath-container">
          <PathWithFileIcon
            className="recent-files-provider-file-path"
            path={filename}>
            {filePath}
          </PathWithFileIcon>
          <span className="recent-files-provider-file-name">
            {filename}
          </span>
        </div>
        <div className="recent-files-provider-datetime-container">
          <span className="recent-files-provider-datetime-label">
            {date === null ? 'At some point' : relativeDate(date)}
          </span>
        </div>
      </div>
    );
  },
};

export function setRecentFilesService(service: RecentFilesService): void {
  _recentFilesService = service;
}
