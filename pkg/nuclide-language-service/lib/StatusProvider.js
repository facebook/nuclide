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

import type {IconName} from 'nuclide-commons-ui/Icon';
import type {LanguageService, StatusData} from './LanguageService';

import {Observable} from 'rxjs';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {track, trackTiming} from 'nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';

export type StatusConfig = {|
  version: '0.1.0',
  priority: number,
  observeEventName: string,
  clickEventName: string,
  description: string,
  icon?: IconName,
  // If the 'icon' is not present, Markdown can be supplied to render a custom
  // icon.
  iconMarkdown?: string,
|};

export class StatusProvider<T: LanguageService> {
  name: string;
  priority: number;
  grammarScopes: Array<string>;
  description: string;
  icon: ?IconName;
  iconMarkdown: ?string;
  _observeEventName: string;
  _clickEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    grammars: Array<string>,
    connectionToLanguageService: ConnectionCache<T>,
    config: StatusConfig,
  ) {
    this.name = name;
    this.grammarScopes = grammars;
    this._connectionToLanguageService = connectionToLanguageService;
    this.priority = config.priority;
    this.description = config.description;
    this.icon = config.icon;
    this.iconMarkdown = config.iconMarkdown;
    this._observeEventName = config.observeEventName;
    this._clickEventName = config.clickEventName;
  }

  static register(
    name: string,
    grammars: Array<string>,
    config: StatusConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-language-status',
      config.version,
      new StatusProvider(name, grammars, connectionToLanguageService, config),
    );
  }

  observeStatus(editor: TextEditor): Observable<StatusData> {
    return Observable.fromPromise(
      Promise.all([
        this._connectionToLanguageService.getForUri(editor.getPath()),
        getFileVersionOfEditor(editor),
      ]),
    ).flatMap(([languageService, fileVersion]) => {
      if (languageService == null || fileVersion == null) {
        return Observable.of({kind: 'null'});
      }
      return languageService
        .observeStatus(fileVersion)
        .refCount()
        .map(status => {
          track(this._observeEventName, {status});
          return status;
        });
    });
  }

  async clickStatus(
    editor: TextEditor,
    id: string,
    button: string,
  ): Promise<void> {
    return trackTiming(this._clickEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = await this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return;
      }
      await languageService.clickStatus(fileVersion, id, button);
    });
  }
}
