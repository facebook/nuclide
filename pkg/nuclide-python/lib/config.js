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

import featureConfig from 'nuclide-commons-atom/feature-config';

export function getAutocompleteArguments(): boolean {
  return (featureConfig.get('nuclide-python.autocompleteArguments'): any);
}

export function getIncludeOptionalArguments(): boolean {
  return (featureConfig.get('nuclide-python.includeOptionalArguments'): any);
}

export function getPythonPath(): string {
  return (featureConfig.get('nuclide-python.pathToPython'): any);
}

export function getShowGlobalVariables(): boolean {
  return (featureConfig.get('nuclide-python.showGlobalVariables'): any);
}

export function getEnableLinting(): boolean {
  return (featureConfig.get('nuclide-python.enableLinting'): any);
}

export function getLintExtensionBlacklist(): Array<string> {
  return (featureConfig.get('nuclide-python.lintExtensionBlacklist'): any);
}

export function getLintOnFly(): boolean {
  return (featureConfig.get('nuclide-python.lintOnFly'): any);
}
