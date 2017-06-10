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

import type {HyperclickSuggestion} from 'atom-ide-ui';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {GRAMMARS, EXTENSIONS} from './constants';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {getMerlinServiceByNuclideUri} from '../../nuclide-remote-connection';

module.exports = {
  priority: 20,
  providerName: 'nuclide-ocaml',
  async getSuggestionForWord(
    textEditor: atom$TextEditor,
    text: string,
    range: atom$Range,
  ): Promise<?HyperclickSuggestion> {
    const {scopeName} = textEditor.getGrammar();
    if (!GRAMMARS.has(scopeName)) {
      return null;
    }

    const file = textEditor.getPath();
    if (file == null) {
      return null;
    }

    const instance = getMerlinServiceByNuclideUri(file);

    try {
      await instance.pushNewBuffer(file, textEditor.getText());
    } catch (e) {
      atom.notifications.addError(e.message, {dismissable: true});
      return null;
    }

    const extension = nuclideUri.extname(file);
    const kind = EXTENSIONS.has(extension) ? extension : 'ml';

    try {
      const location = await instance.locate(
        file,
        range.start.row,
        range.start.column,
        kind,
      );
      if (location != null) {
        return {
          range,
          callback() {
            return goToLocation(
              location.file,
              location.pos.line - 1,
              location.pos.col,
            );
          },
        };
      }
    } catch (e) {}

    return null;
  },
};
