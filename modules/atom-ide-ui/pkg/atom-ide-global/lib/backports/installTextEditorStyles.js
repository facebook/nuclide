/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';
import invariant from 'assert';
import semver from 'semver';

const DEFAULT_FONT_STACK = "Menlo, Consolas, 'DejaVu Sans Mono', monospace";

export default function installTextEditorStyles(): IDisposable {
  if (semver.gte(atom.appVersion, '1.26.0')) {
    // this behavior is part of 1.26 and greater
    return new UniversalDisposable();
  }

  let styleSheetDisposable = new UniversalDisposable();

  return new UniversalDisposable(
    () => styleSheetDisposable.dispose(),
    Observable.combineLatest(
      observableFromSubscribeFunction(
        atom.config.observe.bind(atom.config, 'editor.fontSize'),
      ),
      observableFromSubscribeFunction(
        atom.config.observe.bind(atom.config, 'editor.fontFamily'),
      ),
      observableFromSubscribeFunction(
        atom.config.observe.bind(atom.config, 'editor.lineHeight'),
      ),
    ).subscribe(([fontSize, fontFamily, lineHeight]) => {
      invariant(
        typeof fontSize === 'number' &&
          typeof fontFamily === 'string' &&
          typeof lineHeight === 'number',
      );

      const styleSheetSource = `
        atom-workspace {
          --editor-font-size: ${fontSize}px;
          --editor-font-family: ${fontFamily || DEFAULT_FONT_STACK};
          --editor-line-height: ${lineHeight};
        }
      `;

      styleSheetDisposable.dispose();
      // $FlowIgnore
      styleSheetDisposable = atom.workspace.styleManager.addStyleSheet(
        styleSheetSource,
        {
          sourcePath: 'text-editor-styles-backport',
          priority: -1,
        },
      );
    }),
  );
}
