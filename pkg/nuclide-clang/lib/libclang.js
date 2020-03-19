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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  ClangCompileResult,
  ClangCompletion,
  ClangCursor,
  ClangDeclaration,
  ClangLocalReferences,
  ClangOutlineTree,
  ClangRequestSettings,
  ClangServerSettings,
} from '../../nuclide-clang-rpc/lib/rpc-types';
import type {ClangConfigurationProvider} from './types';

import {arrayCompact} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {checkCqueryOverride} from '../../nuclide-clang-base';
import {isHeaderFile} from '../../nuclide-clang-rpc/lib/utils';
import {getClangServiceByNuclideUri} from '../../nuclide-remote-connection';

type NuclideClangConfig = {
  enableDefaultFlags: boolean,
  defaultFlags: Array<string>,
  serverProcessMemoryLimit: number,
  libclangPath: string,
};

const clangProviders: Set<ClangConfigurationProvider> = new Set();

function getServerSettings(): ClangServerSettings {
  const config: NuclideClangConfig = (featureConfig.get('nuclide-clang'): any);
  let {defaultFlags, libclangPath} = config;
  if (!config.enableDefaultFlags) {
    defaultFlags = null;
  }
  // If the path is empty then don't set it, let server use the default.
  if (libclangPath === '') {
    libclangPath = null;
  }
  return {defaultFlags, libclangPath};
}

async function findSourcePath(path: NuclideUri): Promise<string> {
  if (isHeaderFile(path)) {
    const service = getClangServiceByNuclideUri(path);
    if (service != null) {
      const source = await service.getRelatedSourceOrHeader(path);
      if (source != null) {
        return source;
      }
    }
  }
  return path;
}

async function getClangProvidersForSource(
  _src: NuclideUri,
): Promise<ClangConfigurationProvider[]> {
  const src = await findSourcePath(_src);

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
  if (provider != null && !(await checkCqueryOverride(src))) {
    return provider.getSettings(src);
  }
}

const clangServices = new WeakSet();

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  registerClangProvider(provider: ClangConfigurationProvider): IDisposable {
    clangProviders.add(provider);
    return new UniversalDisposable(() => clangProviders.delete(provider));
  },

  async getRelatedSourceOrHeader(src: string): Promise<?string> {
    if (await checkCqueryOverride(src)) {
      return null;
    }
    return getClangServiceByNuclideUri(src).getRelatedSourceOrHeader(
      src,
      await getClangRequestSettings(src),
    );
  },

  async getDiagnostics(editor: atom$TextEditor): Promise<?ClangCompileResult> {
    const src = editor.getPath();
    if (src == null || (await checkCqueryOverride(src))) {
      return null;
    }
    const contents = editor.getText();

    const defaultSettings = getServerSettings();
    const service = getClangServiceByNuclideUri(src);

    // When we fetch diagnostics for the first time, reset the server state.
    // This is so the user can easily refresh the Clang + Buck state by reloading Atom.
    // At this time we also set the memory limit of the service.
    if (!clangServices.has(service)) {
      const config: NuclideClangConfig = (featureConfig.get(
        'nuclide-clang',
      ): any);
      clangServices.add(service);
      await service.setMemoryLimit(config.serverProcessMemoryLimit);
      await service.reset();
    }

    return service
      .compile(
        src,
        contents,
        await getClangRequestSettings(src),
        defaultSettings,
      )
      .refCount()
      .toPromise();
  },

  async getCompletions(
    editor: atom$TextEditor,
    prefix: string,
  ): Promise<?Array<ClangCompletion>> {
    const src = editor.getPath();
    if (src == null || (await checkCqueryOverride(src))) {
      return null;
    }
    const cursor = editor.getLastCursor();

    const line = cursor.getBufferRow();
    const column = cursor.getBufferColumn();
    const tokenStartColumn = column - prefix.length;

    const defaultSettings = getServerSettings();
    const service = getClangServiceByNuclideUri(src);

    return service.getCompletions(
      src,
      editor.getText(),
      line,
      column,
      tokenStartColumn,
      prefix,
      await getClangRequestSettings(src),
      defaultSettings,
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
    if (src == null || (await checkCqueryOverride(src))) {
      return null;
    }
    const defaultSettings = getServerSettings();
    const service = getClangServiceByNuclideUri(src);
    return service.getDeclaration(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultSettings,
    );
  },

  async getDeclarationInfo(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?Array<ClangCursor>> {
    const src = editor.getPath();
    if (src == null || (await checkCqueryOverride(src))) {
      return Promise.resolve(null);
    }
    const defaultSettings = getServerSettings();

    const service = getClangServiceByNuclideUri(src);
    if (service == null) {
      return Promise.resolve(null);
    }

    return service.getDeclarationInfo(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultSettings,
    );
  },

  async getOutline(editor: atom$TextEditor): Promise<?Array<ClangOutlineTree>> {
    const src = editor.getPath();
    if (src == null || (await checkCqueryOverride(src))) {
      return Promise.resolve();
    }
    const defaultSettings = getServerSettings();
    const service = getClangServiceByNuclideUri(src);
    return service.getOutline(
      src,
      editor.getText(),
      await getClangRequestSettings(src),
      defaultSettings,
    );
  },

  async getLocalReferences(
    editor: atom$TextEditor,
    line: number,
    column: number,
  ): Promise<?ClangLocalReferences> {
    const src = editor.getPath();
    if (src == null || (await checkCqueryOverride(src))) {
      return Promise.resolve(null);
    }
    const defaultSettings = getServerSettings();

    const service = getClangServiceByNuclideUri(src);
    if (service == null) {
      return Promise.resolve(null);
    }

    return service.getLocalReferences(
      src,
      editor.getText(),
      line,
      column,
      await getClangRequestSettings(src),
      defaultSettings,
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
