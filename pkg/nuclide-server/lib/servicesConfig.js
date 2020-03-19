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

import {loadServicesConfig} from '../../nuclide-rpc';
import nuclideUri from 'nuclide-commons/nuclideUri';

export default loadServicesConfig(nuclideUri.join(__dirname, '..'));
