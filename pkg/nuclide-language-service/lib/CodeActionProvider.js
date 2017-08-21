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
  FileDiagnosticMessage,
  CodeAction,
  CodeActionProvider as CodeActionProviderType,
} from 'atom-ide-ui';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from '../../nuclide-analytics';

export type CodeActionConfig = {|
  version: '0.1.0',
  priority: number,
  analyticsEventName: string,
|};

export class CodeActionProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  priority: number;
  name: string;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.grammarScopes = grammarScopes;
    this.priority = priority;
    this._analyticsEventName = analyticsEventName;
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
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ),
    );
  }

  getCodeActions(
    editor: atom$TextEditor,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return [];
      }

      return (await languageService).getCodeActions(
        fileVersion,
        range,
        diagnostics,
      );
    });
  }
}

// Ensures that CodeActionProvider has all the fields and methods defined in
// the CodeActionProvider type in the atom-ide-code-actions package.
(((null: any): CodeActionProvider<LanguageService>): CodeActionProviderType);
