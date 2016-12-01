'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {refmtResult} from '../../nuclide-ocaml-rpc/lib/ReasonService';

import {getReasonServiceByNuclideUri} from '../../nuclide-remote-connection';
import nuclideUri from '../../commons-node/nuclideUri';
import {shellParse} from '../../commons-node/string';
import featureConfig from '../../commons-atom/featureConfig';

function isInterfaceF(filePath: string) {
  const ext = nuclideUri.extname(filePath);
  return ext === '.rei' || ext === '.mli';
}

function getRefmtFlags(): Array<string> {
  const configVal: any = featureConfig.get('nuclide-ocaml.refmtFlags') || '';
  return shellParse(configVal);
}

async function formatImpl(
  editor: atom$TextEditor,
  subText: string,
): Promise<?refmtResult> {
  const path = editor.getPath();
  if (path == null) {
    return null;
  }
  const instance = getReasonServiceByNuclideUri(path);

  const syntaxArg = editor.getGrammar().name === 'Reason' ? 're' : 'ml';
  // Pass the flags here rather than in the service, so that we pick no the
  // extra flags in the (client side) refmtFlags
  const flags = [
    // We pipe the current editor buffer into refmt rather than passing the path
    // because the editor buffer might not have been saved to disk.
    '-use-stdin',
    'true',
    '-parse',
    syntaxArg,
    '-print',
    syntaxArg,
    '-is-interface-pp',
    isInterfaceF(path) ? 'true' : 'false',
    ...getRefmtFlags(),
  ];
  return instance.format(editor.getText(), flags);
}

export async function getEntireFormatting(
  editor: atom$TextEditor,
  range: atom$Range,
): Promise<{newCursor?: number, formatted: string}> {
  const buffer = editor.getBuffer();
  const wholeText = buffer.getText();
  const result: ?refmtResult = await formatImpl(editor, wholeText);

  if (result == null) {
    return {formatted: wholeText};
  } else if (result.type === 'error') {
    throw new Error(result.error);
  } else {
    return {formatted: result.formattedResult};
  }
}
