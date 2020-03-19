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

import type {AutocompleteProvider} from '../types';

// Make sure that AutocompleteProvider is a super type of
// atom$AutocompleteProvider
(((null: any): AutocompleteProvider<
  atom$AutocompleteSuggestion,
>): atom$AutocompleteProvider);
