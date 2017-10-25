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

import {ROOT_FS} from '../../nuclide-fs';
import {ArchiveFileSystem} from './ArchiveFileSystem';

export {ArchiveDirectory} from './ArchiveDirectory';
export {ArchiveFile} from './ArchiveFile';
export {ArchiveFileAsDirectory} from './ArchiveFileAsDirectory';
export {ArchiveFileSystem} from './ArchiveFileSystem';

export const ROOT_ARCHIVE_FS = new ArchiveFileSystem(ROOT_FS);
