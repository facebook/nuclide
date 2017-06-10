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
