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

import type {Provider, FileResult} from '../../nuclide-quick-open/lib/types';

import HighlightedText from 'nuclide-commons-ui/HighlightedText';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getMatchRanges} from 'nuclide-commons/string';
import {getCodeSearchServiceByNuclideUri} from '../../nuclide-remote-connection';
import {Observable} from 'rxjs';
import * as React from 'react';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';
import {Subject} from 'rxjs';
import escapeRegExp from 'escape-string-regexp';
import {pickConfigByUri} from './utils';

type CodeSearchFileResult = {|
  path: string,
  query: string,
  line: number,
  column: number,
  context: string,
  displayPath: string,
  isFirstResultForPath: boolean,
  resultType: 'FILE',
|};

const directoriesObs: Subject<atom$Directory> = new Subject();

const SEARCH_TIMEOUT = 10000;

export const CodeSearchProvider: Provider<FileResult> = {
  name: 'CodeSearchProvider',
  providerType: 'DIRECTORY',
  debounceDelay: 250,
  display: {
    action: 'nuclide-code-search:toggle-provider',
    prompt:
      'Search code using tools like rg or ack. Configure using the Nuclide config...',
    title: 'Code Search',
  },
  async isEligibleForDirectory(directory: atom$Directory): Promise<boolean> {
    try {
      const {
        isAvailableForPath,
        // $FlowFB
      } = require('../../commons-atom/fb-biggrep-query');
      if (await isAvailableForPath(directory.getPath())) {
        return false;
      }
    } catch (err) {}
    const projectRoot = directory.getPath();
    return getCodeSearchServiceByNuclideUri(projectRoot).isEligibleForDirectory(
      projectRoot,
    );
  },
  async executeQuery(
    query: string,
    directory: atom$Directory,
  ): Promise<FileResult[]> {
    directoriesObs.next(directory);
    if (query.length === 0) {
      return [];
    }
    const projectRoot = directory.getPath();
    let lastPath = null;
    const config = pickConfigByUri(projectRoot);
    const regexp = new RegExp(escapeRegExp(query), 'i');

    return (
      getCodeSearchServiceByNuclideUri(projectRoot)
        .codeSearch(
          projectRoot,
          regexp,
          config.useVcsSearch,
          config.tool.length === 0 ? null : config.tool,
          config.maxResults,
        )
        .refCount()
        .map(match => {
          const result = {
            isFirstResultForPath: match.file !== lastPath,
            path: match.file,
            query,
            line: match.row,
            column: match.column,
            context: match.line,
            displayPath: `./${nuclideUri
              .relative(projectRoot, match.file)
              .replace(/\\/g, '/')}`,
            resultType: 'FILE',
          };
          lastPath = match.file;
          return result;
        })
        .timeout(SEARCH_TIMEOUT)
        .catch(() => Observable.empty())
        .toArray()
        .takeUntil(directoriesObs.filter(dir => dir.getPath() === projectRoot))
        .toPromise()
        // toPromise yields undefined if it was interrupted.
        .then(result => result || [])
    );
  },
  getComponentForItem(_item: FileResult): React.Element<any> {
    const item = ((_item: any): CodeSearchFileResult);
    return (
      <div
        className={
          item.isFirstResultForPath
            ? 'code-search-provider-result-first-result-for-path'
            : null
        }>
        {item.isFirstResultForPath && (
          <PathWithFileIcon
            className="code-search-provider-result-path"
            path={item.path}>
            {item.displayPath}
          </PathWithFileIcon>
        )}
        <div className="code-search-provider-result-context">
          <HighlightedText
            highlightedRanges={getMatchRanges(
              // The search is case-insensitive.
              item.context.toLowerCase(),
              item.query.toLowerCase(),
            )}
            text={item.context}
          />
        </div>
      </div>
    );
  },
};
