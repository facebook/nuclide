/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Observable} from 'rxjs';
import type {CompilationDatabaseParams} from '../../nuclide-buck/lib/types';
import type {
  ClangRequestSettings,
  ClangCursor,
} from '../../nuclide-clang-rpc/lib/rpc-types';

export type ClangConfigurationProvider = {
  getSettings: string => Promise<?ClangRequestSettings>,
  reset: (host: string) => void,
  resetForSource: (src: string) => void,
  supportsSource: (src: string) => Promise<boolean>,
  observeClangParams: () => Observable<{
    root: ?NuclideUri,
    params: CompilationDatabaseParams,
  }>,
  priority: number,
};

export type ClangDeclarationInfoProvider = {
  getDeclarationInfo: (
    editor: atom$TextEditor,
    line: number,
    column: number,
  ) => Promise<?Array<ClangCursor>>,
};
