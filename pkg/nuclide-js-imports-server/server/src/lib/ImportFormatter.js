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

import nuclideUri from 'nuclide-commons/nuclideUri';

import type {JSExport} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

const EXTENTIONS_TO_REMOVE = ['.js'];

export class ImportFormatter {
  moduleDirs: Array<string>;
  isHaste: boolean;

  constructor(dirs: Array<string>, isHaste: boolean) {
    this.moduleDirs = dirs;
    this.isHaste = isHaste;
  }

  formatImport(file: NuclideUri, exp: JSExport): string {
    const {isTypeExport, id, isDefault} = exp;

    return isDefault
      ? `import ${id} from '${this.formatImportFile(file, exp)}'`
      : `import ${isTypeExport
          ? 'type '
          : ''}{${id}} from '${this.formatImportFile(file, exp)}'`;
  }

  _formatHasteImportFile(file: NuclideUri, exp: JSExport): string {
    return nuclideUri.basename(nuclideUri.stripExtension(exp.uri));
  }

  formatImportFile(file: NuclideUri, exp: JSExport): string {
    if (this.isHaste) {
      return this._formatHasteImportFile(file, exp);
    }
    const uri = abbreviateMainFiles(exp);
    const pathRelativeToModules = handleModules(uri, file, this.moduleDirs);
    // flowlint-next-line sketchy-null-string:off
    if (pathRelativeToModules) {
      return removeFileExtensions(pathRelativeToModules);
    }

    let pathRelativeToFile = nuclideUri.relative(nuclideUri.dirname(file), uri);

    // Convert types.js => ./types.js
    pathRelativeToFile = pathRelativeToFile.startsWith('.')
      ? pathRelativeToFile
      : './' + pathRelativeToFile;

    return removeFileExtensions(pathRelativeToFile);
  }

  stripLeadingDots(file: NuclideUri): NuclideUri {
    return file.startsWith('..')
      ? nuclideUri.join('', ...nuclideUri.split(file).filter(e => e !== '..'))
      : file;
  }
}

function handleModules(
  fileWithExport: NuclideUri,
  fileMissingImport: NuclideUri,
  moduleDirs: Array<string>,
): ?string {
  const moduleDirOfExport = getFileModuleDirectory(fileWithExport, moduleDirs);

  // flowlint-next-line sketchy-null-string:off
  if (!moduleDirOfExport) {
    return null;
  }

  // If the export is from a module, we need to check if we are importing the
  // file from that same module. If so, the import must be relative.
  const moduleDirOfImport = getFileModuleDirectory(
    fileMissingImport,
    moduleDirs,
  );
  if (
    moduleDirOfImport != null &&
    moduleDirOfImport === moduleDirOfExport &&
    getModule(fileMissingImport, moduleDirOfImport) ===
      getModule(fileWithExport, moduleDirOfExport)
  ) {
    // Import should be relative to the file we are importing from, so return null.
    return null;
  }

  // Import should be relative to the module.
  return nuclideUri.relative(moduleDirOfExport, fileWithExport);
}

function abbreviateMainFiles(exp: JSExport): string {
  // flowlint-next-line sketchy-null-string:off
  return exp.directoryForMainFile || exp.uri;
}

function removeFileExtensions(file: NuclideUri): string {
  for (const extension of EXTENTIONS_TO_REMOVE) {
    if (file.endsWith(extension)) {
      return file.substring(0, file.length - extension.length);
    }
  }
  return file;
}

function getFileModuleDirectory(
  file: NuclideUri,
  moduleDirs: Array<string>,
): ?string {
  return moduleDirs.find(moduleDir => nuclideUri.contains(moduleDir, file));
}

function getModule(file: NuclideUri, moduleDirectory: string): ?string {
  return nuclideUri.split(nuclideUri.relative(moduleDirectory, file))[0];
}
