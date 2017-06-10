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

import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {LanguageService} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from '../../nuclide-analytics';

export type TypeHintConfig = {|
  version: '0.0.0',
  priority: number,
  analyticsEventName: string,
|};

export class TypeHintProvider<T: LanguageService> {
  providerName: string;
  selector: string;
  inclusionPriority: number;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    name: string,
    selector: string,
    priority: number,
    analyticsEventName: string,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.providerName = name;
    this.selector = selector;
    this.inclusionPriority = priority;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    name: string,
    selector: string,
    config: TypeHintConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'nuclide-type-hint.provider',
      config.version,
      new TypeHintProvider(
        name,
        selector,
        config.priority,
        config.analyticsEventName,
        connectionToLanguageService,
      ),
    );
  }

  async typeHint(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?TypeHint> {
    return trackTiming(this._analyticsEventName, async () => {
      const fileVersion = await getFileVersionOfEditor(editor);
      const languageService = this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null || fileVersion == null) {
        return null;
      }

      return (await languageService).typeHint(fileVersion, position);
    });
  }
}
