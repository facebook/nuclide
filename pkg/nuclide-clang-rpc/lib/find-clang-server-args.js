'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import nuclideUri from '../../commons-node/nuclideUri';

import {asyncExecute} from '../../commons-node/process';

let fbFindClangServerArgs;

export type ClangServerArgs = {
  libClangLibraryFile: ?string,
  pythonExecutable: string,
  pythonPathEnv: ?string,
};

export default async function findClangServerArgs(): Promise<ClangServerArgs> {
  if (fbFindClangServerArgs === undefined) {
    fbFindClangServerArgs = null;
    try {
      // $FlowFB
      fbFindClangServerArgs = require('./fb/find-clang-server-args');
    } catch (e) {
      // Ignore.
    }
  }

  let libClangLibraryFile;
  if (process.platform === 'darwin') {
    const result = await asyncExecute('xcode-select', ['--print-path']);
    if (result.exitCode === 0) {
      libClangLibraryFile = result.stdout.trim();
      // If the user only has Xcode Command Line Tools installed, the path is different.
      if (nuclideUri.basename(libClangLibraryFile) !== 'CommandLineTools') {
        libClangLibraryFile += '/Toolchains/XcodeDefault.xctoolchain';
      }
      libClangLibraryFile += '/usr/lib/libclang.dylib';
    }
  }

  // TODO(asuarez): Fix this when we have server-side settings.
  if (global.atom) {
    const path = ((atom.config.get('nuclide.nuclide-clang.libclangPath'): any): ?string);
    if (path) {
      libClangLibraryFile = path.trim();
    }
  }

  const clangServerArgs = {
    libClangLibraryFile,
    pythonExecutable: 'python2.7',
    pythonPathEnv: nuclideUri.join(__dirname, '../VendorLib'),
  };
  if (typeof fbFindClangServerArgs === 'function') {
    const clangServerArgsOverrides = await fbFindClangServerArgs();
    return {...clangServerArgs, ...clangServerArgsOverrides};
  } else {
    return clangServerArgs;
  }
}
