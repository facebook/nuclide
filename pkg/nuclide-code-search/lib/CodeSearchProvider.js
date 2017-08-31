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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getCodeSearchServiceByNuclideUri} from '../../nuclide-remote-connection';
import {Observable} from 'rxjs';
import * as React from 'react';
import PathWithFileIcon from '../../nuclide-ui/PathWithFileIcon';
import featureConfig from 'nuclide-commons-atom/feature-config';

type CodeSearchFileResult = {
  path: string,
  query: string,
  line: number,
  column: number,
  context: string,
  relativePath: string,
  isFirstResultForPath: boolean,
};

type NuclideCodeSearchConfig = {
  tool: string,
  maxResults: number,
};

export const CodeSearchProvider: Provider = {
  name: 'CodeSearchProvider',
  providerType: 'DIRECTORY',
  debounceDelay: 250,
  display: {
    action: 'nuclide-code-search:toggle-provider',
    prompt:
      'Search code using tools like ag, rg or ack. Configure using the Nuclide config...',
    title: 'Code Search',
  },
  async isEligibleForDirectory(directory: atom$Directory): Promise<boolean> {
    const projectRoot = directory.getPath();
    return getCodeSearchServiceByNuclideUri(projectRoot).isEligibleForDirectory(
      projectRoot,
    );
  },
  async executeQuery(
    query: string,
    directory: atom$Directory,
  ): Promise<FileResult[]> {
    if (query.length === 0) {
      return [];
    }
    const projectRoot = directory.getPath();
    let lastPath = null;
    const config: NuclideCodeSearchConfig = (featureConfig.get(
      'nuclide-code-search',
    ): any);

    return getCodeSearchServiceByNuclideUri(projectRoot)
      .searchWithTool(
        config.tool.length === 0 ? null : config.tool,
        projectRoot,
        query,
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

          relativePath: '.' + nuclideUri.relative(projectRoot, match.file),
        };
        lastPath = match.file;
        return result;
      })
      .catch(() => Observable.empty())
      .toArray()
      .map(results => (results.length <= 1 ? [] : results))
      .toPromise();
  },
  getComponentForItem(_item: FileResult): React.Element<any> {
    const item = ((_item: any): CodeSearchFileResult);
    const context = replaceAndWrap(
      item.context || '',
      item.query,
      (rest, i) =>
        <span
          key={`rest-${i}`}
          className="code-search-provider-result-context-rest">
          {rest}
        </span>,
      (match, i) =>
        <span
          key={`match-${i}`}
          className="code-search-provider-result-context-match">
          {match}
        </span>,
    );
    return (
      <div
        className={
          item.isFirstResultForPath
            ? 'code-search-provider-result-first-result-for-path'
            : null
        }>
        {item.isFirstResultForPath &&
          <PathWithFileIcon
            className="code-search-provider-result-path"
            path={item.relativePath}
          />}
        <div className="code-search-provider-result-context">
          {context}
        </div>
      </div>
    );
  },
};

function replaceAndWrap<T>(
  str: string,
  search: string,
  wrapRest: (rest: string, index: number) => T,
  wrapMatch: (match: string, index: number) => T,
): Array<T> {
  // Generate a unique React `key` for each item in the result.
  let resultCount = 0;
  if (!search) {
    return [wrapRest(str, resultCount++)];
  }
  let current = str;
  const result = [];
  while (true) {
    const index = current.toLowerCase().indexOf(search.toLowerCase());
    if (index === -1) {
      break;
    }
    if (index !== 0) {
      result.push(wrapRest(current.slice(0, index), resultCount++));
    }
    result.push(
      wrapMatch(current.slice(index, index + search.length), resultCount++),
    );
    current = current.slice(index + search.length);
  }
  if (current.length) {
    result.push(wrapRest(current, resultCount++));
  }
  return result;
}
