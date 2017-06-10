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

import type {LinterMessage} from 'atom-ide-ui';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getPythonServiceByNuclideUri} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getDiagnosticRange} from './diagnostic-range';
import {getEnableLinting, getLintExtensionBlacklist} from './config';

export default class LintHelpers {
  static lint(editor: TextEditor): Promise<Array<LinterMessage>> {
    const src = editor.getPath();
    if (
      src == null ||
      !getEnableLinting() ||
      getLintExtensionBlacklist().includes(nuclideUri.extname(src))
    ) {
      return Promise.resolve([]);
    }

    return trackTiming('nuclide-python.lint', async () => {
      const service = getPythonServiceByNuclideUri(src);
      const diagnostics = await service.getDiagnostics(src, editor.getText());
      if (editor.isDestroyed()) {
        return [];
      }
      return diagnostics.map(diagnostic => ({
        name: 'flake8: ' + diagnostic.code,
        type: diagnostic.type,
        text: diagnostic.message,
        filePath: diagnostic.file,
        range: getDiagnosticRange(diagnostic, editor),
      }));
    });
  }
}
