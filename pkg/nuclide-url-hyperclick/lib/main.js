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

import type {HyperclickProvider} from 'atom-ide-ui';

import HyperclickProviderHelpers from './HyperclickProviderHelpers';

export function getHyperclickProvider(): HyperclickProvider {
  return {
    providerName: 'url-hyperclick',
    // Allow all language-specific providers to take priority.
    priority: 5,
    wordRegExp: /[^\s]+/g,
    getSuggestionForWord(textEditor, text, range) {
      return HyperclickProviderHelpers.getSuggestionForWord(
        textEditor,
        text,
        range,
      );
    },
  };
}
