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

import type {BlameForEditor} from '../../nuclide-blame/lib/types';

import {hgRepositoryForEditor} from './common';
import {trackTiming} from '../../nuclide-analytics';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-blame-provider-hg');

function canProvideBlameForEditor(editor: atom$TextEditor): boolean {
  if (editor.isModified()) {
    atom.notifications.addInfo(
      'There is Hg blame information for this file, but only for saved changes. ' +
        'Save, then try again.',
    );
    logger.info(
      'nuclide-blame: Could not open Hg blame due to unsaved changes in file: ' +
        String(editor.getPath()),
    );
    return false;
  }
  const repo = hgRepositoryForEditor(editor);
  return Boolean(repo);
}

function getBlameForEditor(editor: atom$TextEditor): Promise<BlameForEditor> {
  return trackTiming('blame-provider-hg:getBlameForEditor', () =>
    doGetBlameForEditor(editor),
  );
}

async function doGetBlameForEditor(
  editor: atom$TextEditor,
): Promise<BlameForEditor> {
  const path = editor.getPath();
  // flowlint-next-line sketchy-null-string:off
  if (!path) {
    return Promise.resolve([]);
  }

  const repo = hgRepositoryForEditor(editor);
  if (!repo) {
    const message = `HgBlameProvider could not fetch blame for ${path}: no Hg repo found.`;
    logger.error(message);
    throw new Error(message);
  }

  return repo.getBlameAtHead(path);
}

let getUrlForRevision;
try {
  // $FlowFB
  const {getPhabricatorUrlForRevision} = require('./fb/FbHgBlameProvider');
  getUrlForRevision = getPhabricatorUrlForRevision;
} catch (e) {
  // Ignore case where FbHgBlameProvider is unavailable.
}

export default {
  canProvideBlameForEditor,
  getBlameForEditor,
  getUrlForRevision,
};
