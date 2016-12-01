'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {LinterMessage} from '../../nuclide-diagnostics-common';

import invariant from 'assert';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getDiagnosticRange} from './diagnostic-range';
import {getEnableLinting} from './config';

export default class LintHelpers {

  static lint(editor: TextEditor): Promise<Array<LinterMessage>> {
    return trackTiming('nuclide-python.lint', async () => {
      const src = editor.getPath();
      if (src == null || !getEnableLinting()) {
        return [];
      }

      const service = getServiceByNuclideUri('PythonService', src);
      invariant(service);

      const diagnostics = await service.getDiagnostics(src, editor.getText());
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
