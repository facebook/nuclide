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

import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {getLogger} from 'log4js';

type HackConfig = {
  hhClientPath: string,
  logLevel: LogLevel,
};

export const HACK_CONFIG_PATH = 'nuclide-hack';
export const SHOW_TYPE_COVERAGE_CONFIG_PATH =
  HACK_CONFIG_PATH + '.showTypeCoverage';

export function getConfig(): HackConfig {
  return featureConfig.getWithDefaults(HACK_CONFIG_PATH, {
    hhClientPath: '',
    logLevel: 'INFO',
  });
}

const LOGGER_CATEGORY = 'nuclide-hack';
export const logger = getLogger(LOGGER_CATEGORY);

function initializeLogging(): void {
  const config = getConfig();
  logger.setLevel(config.logLevel);
}

initializeLogging();
