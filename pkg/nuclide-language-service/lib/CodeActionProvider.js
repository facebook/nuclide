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

import type {LanguageService} from './LanguageService';
import type {
  CodeAction,
  CodeActionProvider as CodeActionProviderType,
  DiagnosticMessage,
} from 'atom-ide-ui';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from '../../nuclide-analytics';

export type CodeActionConfig = {|
  version: '0.1.0',
  priority: number,
  analyticsEventName: string,
  applyAnalyticsEventName: string,
|};

export class CodeActionProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  priority: number;
  name: string;
  _analyticsEventName: string;
  _applyAnalyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    config: CodeActionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.grammarScopes = grammarScopes;
    this.priority = config.priority;
    this._analyticsEventName = config.analyticsEventName;
    this._applyAnalyticsEventName = config.applyAnalyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: CodeActionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'code-actions',
      config.version,
      new CodeActionProvider(
        name,
        grammarScopes,
        config,
        connectionToLanguageService,
      ),
    );
  }

  getCodeActions(
    editor: atom$TextEditor,
    range: atom$Range,
    diagnostics: Array<DiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return [];
      }

      const codeActions = await (await languageService).getCodeActions(
        fileVersion,
        range,
        // $FlowIssue: Flow doesn't understand this.
        diagnostics.map(d => ({...d, actions: undefined})),
      );

      return codeActions.map(action => ({
        apply: () => {
          return trackTiming(
            this._applyAnalyticsEventName,
            action.apply.bind(action),
          );
        },
        getTitle() {
          return action.getTitle();
        },
        dispose() {
          return action.dispose();
        },
      }));
    });
  }
}

// Ensures that CodeActionProvider has all the fields and methods defined in
// the CodeActionProvider type in the atom-ide-code-actions package.
(((null: any): CodeActionProvider<LanguageService>): CodeActionProviderType);
