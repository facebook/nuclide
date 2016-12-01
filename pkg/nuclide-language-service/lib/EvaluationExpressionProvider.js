'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';
import type {LanguageService} from './LanguageService';

import {trackTiming} from '../../nuclide-analytics';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type EvaluationExpressionConfig = {
  version: '0.0.0',
  analyticsEventName: string,
};

export class EvaluationExpressionProvider<T: LanguageService> {
  selector: string;
  name: string;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    selector: string,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.selector = selector;
    this._analyticsEventName = analyticsEventName;
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
        connectionToLanguageService,
      ));
  }

  getEvaluationExpression(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(editor.getPath());
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return await (await languageService).getEvaluationExpression(
        fileVersion, position);
    });
  }
}
