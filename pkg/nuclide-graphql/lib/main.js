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

import {
  graphqlLanguageService,
  resetGraphQLLanguageService,
} from './GraphQLLanguage';

export function activate() {
  if (process.platform !== 'win32') {
    graphqlLanguageService.then(value => value.activate());
  }
}

export function deactivate(): void {
  if (process.platform !== 'win32') {
    resetGraphQLLanguageService();
  }
}
