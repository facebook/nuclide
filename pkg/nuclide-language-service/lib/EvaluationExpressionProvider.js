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
  NuclideEvaluationExpression,
} from '../../nuclide-debugger-interfaces/rpc-types';
import type {LanguageService} from './LanguageService';

import {trackTiming} from '../../nuclide-analytics';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {getDefaultEvaluationExpression} from '../../nuclide-debugger-base';

export type MatcherType =
  | {
      kind: 'default',
    }
  | {
      kind: 'call-service',
    }
  | {
      kind: 'custom',
      matcher: EvaluationExpressionMatcher,
    };

export type EvaluationExpressionMatcher = (
  editor: atom$TextEditor,
  position: atom$Point,
) => ?NuclideEvaluationExpression;

export type EvaluationExpressionConfig = {|
  version: '0.0.0',
  analyticsEventName: string,
  matcher: MatcherType,
|};

export class EvaluationExpressionProvider<T: LanguageService> {
  selector: string;
  name: string;
  _analyticsEventName: string;
  _matcher: MatcherType;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    selector: string,
    analyticsEventName: string,
    matcher: MatcherType,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.selector = selector;
    this._analyticsEventName = analyticsEventName;
    this._matcher = matcher;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    selector: string,
    config: EvaluationExpressionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-evaluation-expression.provider',
      config.version,
      new EvaluationExpressionProvider(
        name,
        selector,
        config.analyticsEventName,
        config.matcher,
        connectionToLanguageService,
      ),
    );
  }

  getEvaluationExpression(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    return trackTiming(this._analyticsEventName, async () => {
      if (this._matcher.kind === 'default') {
        return getDefaultEvaluationExpression(editor, position);
      } else if (this._matcher.kind === 'custom') {
        return this._matcher.matcher(editor, position);
      } else if (this._matcher.kind === 'call-service') {
        const fileVersion = await getFileVersionOfEditor(editor);
        const languageService = this._connectionToLanguageService.getForUri(
          editor.getPath(),
        );
        if (languageService == null || fileVersion == null) {
          return null;
        }

        return (await languageService).getEvaluationExpression(
          fileVersion,
          position,
        );
      } else {
        throw new Error(
          `Invalid evaluation expression matcher: ${String(this._matcher)}`,
        );
      }
    });
  }
}

export function getEvaluationExpressionFromRegexp(
  editor: atom$TextEditor,
  position: atom$Point,
  regexp: RegExp,
): ?NuclideEvaluationExpression {
  const extractedIdentifier = wordAtPosition(editor, position, regexp);
  if (extractedIdentifier == null) {
    return null;
  }
  const {range, wordMatch} = extractedIdentifier;
  const [expression] = wordMatch;
  return expression == null ? null : {expression, range};
}
