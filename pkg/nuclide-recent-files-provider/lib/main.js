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

import type {FileResult, Provider} from '../../nuclide-quick-open/lib/types';
import type RecentFilesService from '../../nuclide-recent-files-service/lib/RecentFilesService';

import {
  RecentFilesProvider,
  setRecentFilesService,
} from './RecentFilesProvider';

export function registerProvider(): Provider<FileResult> {
  return RecentFilesProvider;
}

export function consumeRecentFilesService(service: RecentFilesService): void {
  setRecentFilesService(service);
}
