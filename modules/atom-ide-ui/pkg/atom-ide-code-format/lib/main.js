/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {
  CodeFormatProvider,
  RangeCodeFormatProvider,
  FileCodeFormatProvider,
  OnTypeCodeFormatProvider,
  OnSaveCodeFormatProvider,
} from './types';

import createPackage from 'nuclide-commons-atom/createPackage';
import CodeFormatManager from './CodeFormatManager';

class Activation {
  codeFormatManager: CodeFormatManager;

  constructor() {
    this.codeFormatManager = new CodeFormatManager();
  }

  consumeLegacyProvider(provider: CodeFormatProvider): IDisposable {
    // Legacy providers used `selector` / `inclusionPriority`.
    provider.grammarScopes =
      provider.grammarScopes ||
      (provider.selector != null ? provider.selector.split(', ') : null);
    provider.priority =
      provider.priority != null
        ? provider.priority
        : provider.inclusionPriority != null ? provider.inclusionPriority : 0;
    if (provider.formatCode) {
      return this.consumeRangeProvider(provider);
    } else if (provider.formatEntireFile) {
      return this.consumeFileProvider(provider);
    } else if (provider.formatAtPosition) {
      return this.consumeOnTypeProvider(provider);
    } else if (provider.formatOnSave) {
      return this.consumeOnSaveProvider(provider);
    }
    throw new Error('Invalid code format provider');
  }

  consumeRangeProvider(provider: RangeCodeFormatProvider): IDisposable {
    return this.codeFormatManager.addRangeProvider(provider);
  }

  consumeFileProvider(provider: FileCodeFormatProvider): IDisposable {
    return this.codeFormatManager.addFileProvider(provider);
  }

  consumeOnTypeProvider(provider: OnTypeCodeFormatProvider): IDisposable {
    return this.codeFormatManager.addOnTypeProvider(provider);
  }

  consumeOnSaveProvider(provider: OnSaveCodeFormatProvider): IDisposable {
    return this.codeFormatManager.addOnSaveProvider(provider);
  }

  dispose() {
    this.codeFormatManager.dispose();
  }
}

createPackage(module.exports, Activation);
