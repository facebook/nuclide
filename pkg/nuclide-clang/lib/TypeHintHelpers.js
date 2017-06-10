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

import {trackTiming} from '../../nuclide-analytics';
import {getDeclaration} from './libclang';

// Types longer than this will be truncated.
const MAX_LENGTH = 256;

export default class TypeHintHelpers {
  static typeHint(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?TypeHint> {
    return trackTiming('nuclide-clang-atom.typeHint', async () => {
      const decl = await getDeclaration(editor, position.row, position.column);
      if (decl == null) {
        return null;
      }
      const {type, extent: range} = decl;
      if (type == null || type.trim() === '') {
        return null;
      }
      let hint = type;
      if (type.length > MAX_LENGTH) {
        hint = type.substr(0, MAX_LENGTH) + '...';
      }
      return {hint, range};
    });
  }
}
