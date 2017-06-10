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

import {trackTiming} from '../../nuclide-analytics';
import {getLogger} from 'log4js';

import libclang from './libclang';

export default class CodeFormatHelpers {
  static formatEntireFile(
    editor: atom$TextEditor,
    range: atom$Range,
  ): Promise<{
    newCursor?: number,
    formatted: string,
  }> {
    return trackTiming('nuclide-clang-format.formatCode', async () => {
      try {
        return await libclang.formatCode(editor, range);
      } catch (e) {
        getLogger('nuclide-clang').error('Could not run clang-format:', e);
        throw new Error(
          'Could not run clang-format.<br>Ensure it is installed and in your $PATH.',
        );
      }
    });
  }
}
