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

import type {MerlinError} from '../../nuclide-ocaml-rpc';
import type {LinterMessage} from 'atom-ide-ui';

import {GRAMMARS} from './constants';
import {trackTiming} from '../../nuclide-analytics';
import {Range} from 'atom';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import featureConfig from 'nuclide-commons-atom/feature-config';

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = {
  name: 'nuclide-ocaml',
  grammarScopes: Array.from(GRAMMARS),
  scope: 'file',
  lintOnFly: false,

  lint(textEditor: atom$TextEditor): Promise<Array<LinterMessage>> {
    if (!featureConfig.get('nuclide-ocaml.enableDiagnostics')) {
      return Promise.resolve([]);
    }
    return trackTiming('nuclide-ocaml.lint', async () => {
      const filePath = textEditor.getPath();
      if (filePath == null) {
        return [];
      }

      const instance = getServiceByNuclideUri('MerlinService', filePath);
      if (instance == null) {
        return [];
      }
      await instance.pushNewBuffer(filePath, textEditor.getText());
      const diagnostics = await instance.errors(filePath);
      if (diagnostics == null || textEditor.isDestroyed()) {
        return [];
      }
      return diagnostics.map((diagnostic: MerlinError): LinterMessage => {
        const {start, end} = diagnostic;
        return {
          type: diagnostic.type === 'warning' ? 'Warning' : 'Error',
          filePath,
          html: '<pre>' + diagnostic.message + '</pre>',
          range: new Range(
            start == null ? [0, 0] : [start.line - 1, start.col],
            end == null ? [0, 0] : [end.line - 1, end.col],
          ),
        };
      });
    });
  },
};
