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
  FindReferencesReturn,
  FindReferencesProvider as FindReferencesProviderType,
} from 'atom-ide-ui';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import loadingNotification from '../../commons-atom/loading-notification';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type FindReferencesConfig = {|
  version: '0.1.0',
  analyticsEventName: string,
|};

export class FindReferencesProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  name: string;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammarScopes: Array<string>,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.grammarScopes = grammarScopes;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammarScopes: Array<string>,
    config: FindReferencesConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'find-references',
      config.version,
      new FindReferencesProvider(
        name,
        grammarScopes,
        config.analyticsEventName,
        connectionToLanguageService,
      ),
    );
  }

  async isEditorSupported(textEditor: atom$TextEditor): Promise<boolean> {
    return (
      textEditor.getPath() != null &&
      this.grammarScopes.includes(textEditor.getGrammar().scopeName)
    );
  }

  findReferences(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return loadingNotification(
        (await languageService).findReferences(fileVersion, position),
        `Loading references from ${this.name} server...`,
      );
    });
  }
}

(((null: any): FindReferencesProvider<
  LanguageService,
>): FindReferencesProviderType);
