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

import type {BehaviorSubject} from 'rxjs';
import type {
  GenericResult,
  DashProvider,
  QueryContext,
  OpenableResult,
  // $FlowFB
} from '../../fb-dash/lib/types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type FileFamilyAggregator from './FileFamilyAggregator';
import fuzzAldrinPlus from 'fuzzaldrin-plus';

import matchIndexesToRanges from 'nuclide-commons/matchIndexesToRanges';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import {getAlternatesFromGraph} from './FileFamilyUtils';

export default class FileFamilyDashProvider
  implements DashProvider<GenericResult | OpenableResult> {
  debounceDelay = 0;
  display = {
    title: 'File Family',
    prompt: {
      verb: 'Go to',
      object: 'Related file',
    },
    action: 'file-family-dash-provider:toggle-provider',
  };

  prefix = 'alt';
  priority = 10;
  _aggregators: BehaviorSubject<?FileFamilyAggregator>;
  _cwds: BehaviorSubject<?CwdApi>;

  constructor(
    aggregators: BehaviorSubject<?FileFamilyAggregator>,
    cwds: BehaviorSubject<?CwdApi>,
  ) {
    this._aggregators = aggregators;
    this._cwds = cwds;
  }

  executeQuery(
    query: string,
    queryContext: QueryContext,
    callback: (items: Array<GenericResult | OpenableResult>) => mixed,
  ): IDisposable {
    const aggregator = this._aggregators.getValue();
    if (aggregator == null) {
      callback([
        {
          type: 'generic',
          relevance: 1,
          primaryText: 'An error occurred. Please try again.',
        },
      ]);
      return new UniversalDisposable();
    }

    const activeUri = queryContext.focusedUri;
    if (activeUri == null) {
      callback([
        {
          type: 'generic',
          relevance: 1,
          primaryText: 'Open a file to retrieve alternates for it.',
        },
      ]);
      return new UniversalDisposable();
    }

    const results = Observable.defer(() =>
      aggregator.getRelatedFiles(activeUri),
    ).map(graph => {
      const cwd = this._cwds.getValue();
      const projectUri = cwd && cwd.getCwd();
      return getAlternatesFromGraph(graph, activeUri)
        .filter(uri => query === '' || fuzzAldrinPlus.score(uri, query) > 0)
        .sort(
          (a, b) =>
            query === ''
              ? 0
              : fuzzAldrinPlus.score(a, query) - fuzzAldrinPlus.score(b, query),
        )
        .map(alternateUri => ({
          type: 'openable',
          uri: alternateUri,
          uriMatchRanges: matchIndexesToRanges(
            fuzzAldrinPlus.match(alternateUri, query),
          ),
          projectUri:
            projectUri != null && alternateUri.includes(projectUri)
              ? projectUri
              : null,
          openOptions: {},
          relevance: 1,
        }));
    });

    return new UniversalDisposable(results.subscribe(callback));
  }
}
