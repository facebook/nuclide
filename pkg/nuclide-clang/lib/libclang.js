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

import type {
  ClangCompileResult,
  ClangCompletion,
  ClangCursor,
  ClangDeclaration,
  ClangLocalReferences,
  ClangOutlineTree,
} from '../../nuclide-clang-rpc/lib/rpc-types';
import typeof * as ClangService from '../../nuclide-clang-rpc';
import type {ClangCompilationDatabaseProvider} from './types';

import {Disposable} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {
  getClangServiceByNuclideUri,
  getServiceByNuclideUri,
} from '../../nuclide-remote-connection';

type NuclideClangConfig = {
  enableDefaultFlags: boolean,
  defaultFlags: Array<string>,
};

const compilationDatabaseProviders: Set<
  ClangCompilationDatabaseProvider,
> = new Set();

function getDefaultFlags(): ?Array<string> {
  const config: NuclideClangConfig = (featureConfig.get('nuclide-clang'): any);
  if (!config.enableDefaultFlags) {
    return null;
  }
  return config.defaultFlags;
}

async function getCompilationDatabaseFile(src: string): Promise<?string> {
  const compilationDatabases = await Promise.all(
    Array.from(compilationDatabaseProviders.values()).map(provider =>
      provider.getCompilationDatabaseFile(src),
    ),
  );
  for (const compilationDatabase of compilationDatabases) {
    if (compilationDatabase != null) {
      return compilationDatabase;
    }
  }
  return null;
}

const clangServices = new WeakSet();

module.exports = {
  registerCompilationDatabaseProvider(
    provider: ClangCompilationDatabaseProvider,
  ): Disposable {
    compilationDatabaseProviders.add(provider);
    return new Disposable(() => compilationDatabaseProviders.delete(provider));
  },

  getRelatedSourceOrHeader(src: string): Promise<?string> {
    const service = getClangServiceByNuclideUri(src);
    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getRelatedSourceOrHeader(src, compilationDBFile),
    );
  },

  async getDiagnostics(editor: atom$TextEditor): Promise<?ClangCompileResult> {
    const src = editor.getPath();
    if (src == null) {
      return null;
    }
    const contents = editor.getText();

    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);

    // When we fetch diagnostics for the first time, reset the server state.
    // This is so the user can easily refresh the Clang + Buck state by reloading Atom.
    if (!clangServices.has(service)) {
      clangServices.add(service);
      await service.reset();
    }

    return service
      .compile(
        src,
        contents,
        await getCompilationDatabaseFile(src),
        defaultFlags,
      )
      .refCount()
      .toPromise();
  },

  getCompletions(
    editor: atom$TextEditor,
    prefix: string,
  ): Promise<?Array<ClangCompletion>> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve();
    }
    const cursor = editor.getLastCursor();

    const line = cursor.getBufferRow();
    const column = cursor.getBufferColumn();
    const tokenStartColumn = column - prefix.length;

    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);

    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getCompletions(
        src,
        editor.getText(),
        line,
        column,
        tokenStartColumn,
        prefix,
        compilationDBFile,
        defaultFlags,
      ),
    );
  },

  /**
   * If a location can be found for the declaration, it will be available via
   * the 'location' field on the returned object.
   */
  getDeclaration(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?ClangDeclaration> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve();
    }
    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);
    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getDeclaration(
        src,
        editor.getText(),
        line,
        column,
        compilationDBFile,
        defaultFlags,
      ),
    );
  },

  getDeclarationInfo(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?Array<ClangCursor>> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve(null);
    }
    const defaultFlags = getDefaultFlags();

    const service: ?ClangService = getServiceByNuclideUri('ClangService', src);
    if (service == null) {
      return Promise.resolve(null);
    }

    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getDeclarationInfo(
        src,
        editor.getText(),
        line,
        column,
        compilationDBFile,
        defaultFlags,
      ),
    );
  },

  getOutline(editor: atom$TextEditor): Promise<?Array<ClangOutlineTree>> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve();
    }
    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);
    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getOutline(
        src,
        editor.getText(),
        compilationDBFile,
        defaultFlags,
      ),
    );
  },

  getLocalReferences(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?ClangLocalReferences> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve(null);
    }
    const defaultFlags = getDefaultFlags();

    const service: ?ClangService = getServiceByNuclideUri('ClangService', src);
    if (service == null) {
      return Promise.resolve(null);
    }

    return getCompilationDatabaseFile(src).then(compilationDBFile =>
      service.getLocalReferences(
        src,
        editor.getText(),
        line,
        column,
        compilationDBFile,
        defaultFlags,
      ),
    );
  },

  async formatCode(
    editor: atom$TextEditor,
    range: atom$Range,
  ): Promise<{
    newCursor?: number,
    formatted: string,
  }> {
    const fileUri = editor.getPath();
    const buffer = editor.getBuffer();
    const cursor = buffer.characterIndexForPosition(
      editor.getLastCursor().getBufferPosition(),
    );
    if (fileUri == null) {
      return {
        formatted: editor.getText(),
      };
    }
    const startIndex = buffer.characterIndexForPosition(range.start);
    const endIndex = buffer.characterIndexForPosition(range.end);
    const service = getClangServiceByNuclideUri(fileUri);
    return {
      ...(await service.formatCode(
        fileUri,
        editor.getText(),
        cursor,
        startIndex,
        endIndex - startIndex,
      )),
    };
  },

  reset(editor: atom$TextEditor) {
    const src = editor.getPath();
    if (src != null) {
      const service = getClangServiceByNuclideUri(src);
      return service.reset(src);
    }
  },
};
