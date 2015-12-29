'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HgRepositoryClient} from '../../hg-repository-client';

const {repositoryForPath} = require('../../hg-git-bridge');

export function gitRepositoryForEditor(editor: TextEditor): ?atom$Repository {
  const repo = repositoryForPath(editor.getPath() || '');
  if (!repo || repo.getType() !== 'git') {
    return null;
  }
  return ((repo: any): atom$Repository);
}
