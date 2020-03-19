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

import {getLogger} from 'log4js';
import featureConfig from 'nuclide-commons-atom/feature-config';
import passesGK from 'nuclide-commons/passesGK';
import {observeForCodeLens} from './CodeLensListener';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {createLanguageService} from './OCamlLanguage';

let disposables: UniversalDisposable = new UniversalDisposable();

export async function activate(): Promise<void> {
  if (await passesGK('nuclide_fb_ocaml_vscode_ext')) {
    return;
  }
  const ocamlLspLanguageService = createLanguageService();
  ocamlLspLanguageService.activate();
  disposables.add(ocamlLspLanguageService);

  if (featureConfig.get('nuclide-ocaml.codeLens')) {
    disposables.add(
      observeForCodeLens(ocamlLspLanguageService, getLogger('OcamlService')),
    );
  }
}

export async function deactivate(): Promise<void> {
  disposables.dispose();
  disposables = new UniversalDisposable();
}
