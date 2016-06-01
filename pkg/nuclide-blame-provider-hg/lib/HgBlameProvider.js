'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {BlameForEditor} from '../../nuclide-blame-base';

import featureConfig from '../../nuclide-feature-config';
import {hgRepositoryForEditor} from './common';
import {trackOperationTiming} from '../../nuclide-analytics';
import {shortNameForAuthor} from '../../nuclide-vcs-log';

let logger;
function getLogger() {
  if (!logger) {
    logger = require('../../nuclide-logging').getLogger();
  }
  return logger;
}

function canProvideBlameForEditor(editor: atom$TextEditor): boolean {
  if (editor.isModified()) {
    atom.notifications.addInfo(
      'There is Hg blame information for this file, but only for saved changes. ' +
      'Save, then try again.'
    );
    getLogger().info(
      'nuclide-blame: Could not open Hg blame due to unsaved changes in file: ' +
      String(editor.getPath())
    );
    return false;
  }
  const repo = hgRepositoryForEditor(editor);
  return Boolean(repo);
}

function getBlameForEditor(editor: atom$TextEditor): Promise<BlameForEditor> {
  return trackOperationTiming(
    'blame-provider-hg:getBlameForEditor',
    () => doGetBlameForEditor(editor)
  );
}

async function doGetBlameForEditor(editor: atom$TextEditor): Promise<BlameForEditor> {
  const path = editor.getPath();
  if (!path) {
    return Promise.resolve(new Map());
  }

  const repo = hgRepositoryForEditor(editor);
  if (!repo) {
    const message = `HgBlameProvider could not fetch blame for ${path}: no Hg repo found.`;
    getLogger().error(message);
    throw new Error(message);
  }

  const blameInfo = await repo.getBlameAtHead(path);
  // TODO (t8045823) Convert the return type of ::getBlameAtHead to a Map when
  // the service framework supports a Map return type.
  const useShortName = !(featureConfig.get('nuclide-blame-provider-hg.showVerboseBlame'));
  return formatBlameInfo(blameInfo, useShortName);
}

/**
 * Takes a map returned by HgRepositoryClient.getBlameAtHead() and reformats it as a Map of
 * line numbers to blame info to display in the blame gutter. If `useShortName` is false,
 * The blame info is of the form: "Firstname Lastname <username@email.com> ChangeSetID".
 * (The Firstname Lastname may not appear sometimes.) If `useShortName` is true, then the
 * author portion will contain only the username.
 */
function formatBlameInfo(
  rawBlameData: Map<string, string>,
  useShortName: boolean
): BlameForEditor {
  const extractAuthor = useShortName ? shortNameForAuthor : identity;

  const blameForEditor = new Map();
  rawBlameData.forEach((blameName, serializedLineNumber) => {
    const lineNumber = parseInt(serializedLineNumber, 10);
    const index = blameName.lastIndexOf(' ');
    const changeSetId = blameName.substring(index + 1);
    const fullAuthor = blameName.substring(0, index);

    // The ChangeSet ID will be null for uncommitted local changes.
    const blameInfo = {
      author: extractAuthor(fullAuthor),
      changeset: changeSetId !== 'null' ? changeSetId : null,
    };
    blameForEditor.set(lineNumber, blameInfo);
  });
  return blameForEditor;
}

/** @return The input value. */
function identity<T>(anything: T): T {
  return anything;
}

let getUrlForRevision;
try {
  // $FlowFB
  const {getPhabricatorUrlForRevision} = require('./fb/FbHgBlameProvider');
  getUrlForRevision = getPhabricatorUrlForRevision;
} catch (e) {
  // Ignore case where FbHgBlameProvider is unavailable.
}

module.exports = {
  canProvideBlameForEditor,
  getBlameForEditor,
  getUrlForRevision,
  __test__: {
    formatBlameInfo,
  },
};
