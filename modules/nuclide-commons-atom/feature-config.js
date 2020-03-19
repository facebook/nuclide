/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

/**
 * A wrapper over Atom's config functions for use with FeatureLoader.
 * Each individual loaded package's config is a subconfig of the root package.
 */

import ConfigManager from './ConfigManager';

const featureConfigManager = new ConfigManager(atom.config);

export default featureConfigManager;
