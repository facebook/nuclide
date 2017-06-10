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

import type {DefinitionQueryResult} from 'atom-ide-ui';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type DefinitionConfig = {|
  version: '0.1.0',
  priority: number,
  definitionEventName: string,
  definitionByIdEventName: string,
|};

export class DefinitionProvider<T: LanguageService> {
  name: string;
  priority: number;
  grammarScopes: Array<string>;
  _definitionEventName: string;
  _definitionByIdEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammars: Array<string>,
    priority: number,
    definitionEventName: string,
    definitionByIdEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.priority = priority;
    this.grammarScopes = grammars;
    this._definitionEventName = definitionEventName;
    this._definitionByIdEventName = definitionByIdEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    grammars: Array<string>,
    config: DefinitionConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'atom-ide-definitions',
      config.version,
      new DefinitionProvider(
        name,
        grammars,
        config.priority,
        config.definitionEventName,
        config.definitionByIdEventName,
        connectionToLanguageService,
      ),
    );
  }

  async getDefinition(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return trackTiming(this._definitionEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }
      return (await languageService).getDefinition(fileVersion, position);
    });
  }
}
