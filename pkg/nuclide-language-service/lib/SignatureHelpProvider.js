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
import type {SignatureHelp, SignatureHelpRegistry} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {ConnectionCache} from '../../nuclide-remote-connection';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import {trackTiming} from 'nuclide-analytics';

export type SignatureHelpConfig = {|
  version: '0.1.0',
  priority: number,
  // NOTE: We could theoretically have a 'getTriggerCharacters' API
  // to resolve this asynchronously to support servers with dynamic trigger characters.
  // However, we don't have any clear use cases for this yet.
  triggerCharacters?: Set<string>,
  showDocBlock?: boolean,
  analyticsEventName: string,
|};

export class SignatureHelpProvider<T: LanguageService> {
  grammarScopes: Array<string>;
  priority: number;
  triggerCharacters: Set<string> | void;
  showDocBlock: boolean;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;

  constructor(
    grammarScopes: Array<string>,
    config: SignatureHelpConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.grammarScopes = grammarScopes;
    this.triggerCharacters = config.triggerCharacters;
    this.showDocBlock =
      config.showDocBlock != null ? config.showDocBlock : true;
    this._analyticsEventName = config.analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;
  }

  static register(
    grammarScopes: Array<string>,
    config: SignatureHelpConfig,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    const disposables = new UniversalDisposable();
    disposables.add(
      atom.packages.serviceHub.consume(
        'signature-help',
        config.version,
        (registry: SignatureHelpRegistry) => {
          disposables.add(
            registry(
              new SignatureHelpProvider(
                grammarScopes,
                config,
                connectionToLanguageService,
              ),
            ),
          );
        },
      ),
    );
    return disposables;
  }

  getSignatureHelp(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    return trackTiming(this._analyticsEventName, async () => {
      const languageService: ?LanguageService = await this._connectionToLanguageService.getForUri(
        editor.getPath(),
      );
      if (languageService == null) {
        return null;
      }
      const fileVersion = await getFileVersionOfEditor(editor);
      if (fileVersion == null) {
        return null;
      }
      const signatureHelp = await languageService.signatureHelp(
        fileVersion,
        position,
      );

      if (
        !this.showDocBlock &&
        signatureHelp != null &&
        signatureHelp.signatures != null
      ) {
        for (const signature of signatureHelp.signatures) {
          delete signature.documentation;
        }
      }

      return signatureHelp;
    });
  }
}
