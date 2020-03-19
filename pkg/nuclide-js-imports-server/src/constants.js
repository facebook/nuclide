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

import uuid from 'uuid';

// Need to be unique across different js-imports-server instances.
export const ADD_IMPORT_COMMAND_ID = 'addImport' + uuid.v4();
