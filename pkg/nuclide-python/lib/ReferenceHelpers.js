'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import typeof * as PythonService from '../../nuclide-python-rpc';
import type {FindReferencesReturn} from '../../nuclide-find-references/lib/rpc-types';

import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {getAtomProjectRootPath} from '../../commons-atom/projects';
import loadingNotification from '../../commons-atom/loading-notification';
import nuclideUri from '../../commons-node/nuclideUri';
import {Range, Point} from 'simple-text-buffer';

export default class ReferenceHelpers {

  static getReferences(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    return trackTiming(
      'python.get-references',
      () => ReferenceHelpers._getReferences(editor, position),
    );
  }

  static async _getReferences(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    const src = editor.getPath();
    if (!src) {
      return null;
    }

    // Choose the project root as baseUri, or if no project exists,
    // use the dirname of the src file.
    const baseUri = getAtomProjectRootPath(src) || nuclideUri.dirname(src);

    const contents = editor.getText();
    const line = position.row;
    const column = position.column;

    const service: ?PythonService = await getServiceByNuclideUri('PythonService', src);
    if (!service) {
      return null;
    }

    const result = await loadingNotification(
      service.getReferences(
        src,
        contents,
        line,
        column,
      ),
      'Loading references from Jedi server...',
    );

    if (!result || result.length === 0) {
      return {type: 'error', message: 'No usages were found.'};
    }

    const symbolName = result[0].text;

    // Process this into the format nuclide-find-references expects.
    const references = result.map(ref => {
      return {
        uri: ref.file,
        name: ref.parentName,
        range: new Range(
          new Point(ref.line, ref.column),
          new Point(ref.line, ref.column + ref.text.length),
        ),
      };
    });

    return {
      type: 'data',
      baseUri,
      referencedSymbolName: symbolName,
      references,
    };
  }

}
