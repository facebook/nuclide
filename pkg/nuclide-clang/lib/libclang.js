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
  ClangRequestSettings,
} from '../../nuclide-clang-rpc/lib/rpc-types';
import typeof * as ClangService from '../../nuclide-clang-rpc';
import type {ClangConfigurationProvider} from './types';

import {arrayCompact} from 'nuclide-commons/collection';
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

const clangProviders: Set<ClangConfigurationProvider> = new Set();

function getDefaultFlags(): ?Array<string> {
  const config: NuclideClangConfig = (featureConfig.get('nuclide-clang'): any);
  if (!config.enableDefaultFlags) {
    return null;
  }
  return config.defaultFlags;
}

async function getClangProvidersForSource(
  src: string,
): Promise<ClangConfigurationProvider[]> {
  return arrayCompact(
    await Promise.all(
      [...clangProviders].map(async provider => {
        if (await provider.supportsSource(src)) {
          return provider;
        }
        return null;
      }),
    ),
  ).sort(provider => -provider.priority);
}

async function getClangRequestSettings(
  src: string,
): Promise<?ClangRequestSettings> {
  const provider = (await getClangProvidersForSource(src))[0];
  if (provider != null) {
    return provider.getSettings(src);
  }
}

const clangServices = new WeakSet();

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  registerClangProvider(provider: ClangConfigurationProvider): Disposable {
    clangProviders.add(provider);
    return new Disposable(() => clangProviders.delete(provider));
  },

  async getRelatedSourceOrHeader(src: string): Promise<?string> {
    return getClangServiceByNuclideUri(src).getRelatedSourceOrHeader(
      src,
      await getClangRequestSettings(src),
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
      .compile(src, contents, await getClangRequestSettings(src), defaultFlags)
      .refCount()
      .toPromise();
  },

  async getCompletions(
    editor: atom$TextEditor,
    prefix: string,
  ): Promise<?Array<ClangCompletion>> {
    const src = editor.getPath();
    if (src == null) {
      return null;
    }
    const cursor = editor.getLastCursor();

    const line = cursor.getBufferRow();
    const column = cursor.getBufferColumn();
    const tokenStartColumn = column - prefix.length;

    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);

    return service.getCompletions(
      src,
      editor.getText(),
      line,
      column,
      tokenStartColumn,
      prefix,
      await getClangRequestSettings(src),
      defaultFlags,
    );
  },

  /**
   * If a location can be found for the declaration, it will be available via
   * the 'location' field on the returned object.
   */
  async getDeclaration(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?ClangDeclaration> {
    const src = editor.getPath();
    if (src == null) {
      return null;
    }
    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);
    return service.getDeclaration(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultFlags,
    );
  },

  async getDeclarationInfo(
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

    return service.getDeclarationInfo(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultFlags,
    );
  },

  async getOutline(editor: atom$TextEditor): Promise<?Array<ClangOutlineTree>> {
    const src = editor.getPath();
    if (src == null) {
      return Promise.resolve();
    }
    const defaultFlags = getDefaultFlags();
    const service = getClangServiceByNuclideUri(src);
    return service.getOutline(
      src,
      editor.getText(),
      await getClangRequestSettings(src),
      defaultFlags,
    );
  },

  async getLocalReferences(
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

    return service.getLocalReferences(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultFlags,
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

  async resetForSource(editor: atom$TextEditor): Promise<void> {
    const src = editor.getPath();
    if (src != null) {
      (await getClangProvidersForSource(src)).forEach(provider =>
        provider.resetForSource(src),
      );
      const service = getClangServiceByNuclideUri(src);
      return service.resetForSource(src);
    }
  },

  async reset(src: string): Promise<void> {
    (await getClangProvidersForSource(src)).forEach(provider =>
      provider.reset(src),
    );
    await getClangServiceByNuclideUri(src).reset();
  },
};
