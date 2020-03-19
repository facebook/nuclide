/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {LanguageService} from './LanguageService';
import type {
  RefactorProvider as RefactorProviderType,
  RenameReturn,
} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming} from 'nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type RenameConfig = {|
  +version: '0.0.0',
  priority: number,
  analyticsEventName: string,
|};

export class RenameProvider<T: LanguageService> {
  name: string;
  priority: number;
  grammarScopes: Array<string>;
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
    config: RenameConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    const disposable = new UniversalDisposable(
      atom.packages.serviceHub.provide(
        'nuclide-refactor',
        config.version,
        new RenameProvider(
          name,
          grammarScopes,
          config.priority,
          config.analyticsEventName,
          connectionToLanguageService,
        ).provide(),
      ),
    );

    return disposable;
  }

  provide(): RefactorProviderType {
    return {
      rename: this.rename.bind(this),
      grammarScopes: this.grammarScopes,
      priority: this.priority,
    };
  }

  rename(
    editor: TextEditor,
    position: atom$Point,
    newName: string,
  ): Promise<?RenameReturn> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }
      return (await languageService)
        .rename(fileVersion, position, newName)
        .refCount()
        .toPromise();
    });
  }
}
