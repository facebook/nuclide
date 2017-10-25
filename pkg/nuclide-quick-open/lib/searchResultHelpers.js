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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ProviderResult} from './types';

export type ProviderResults = {
  error: ?Object,
  loading: boolean,
  results: Array<ProviderResult>,
};

export type OuterResults = {
  serviceName: string,
  directoryName: NuclideUri,
  results: Array<ProviderResult>,
};

export type GroupedResult = {
  priority: number,
  results: {[key: NuclideUri]: ProviderResults},
  title: string,
  totalResults: number,
};

export type GroupedResults = {
  [key: string]: GroupedResult,
};

import {isEmpty} from 'nuclide-commons/collection';

export function filterEmptyResults(
  resultsGroupedByService: GroupedResults,
): GroupedResults {
  const filteredTree = {};
  for (const serviceName in resultsGroupedByService) {
    const directories = resultsGroupedByService[serviceName].results;
    const nonEmptyDirectories = {};
    for (const dirName in directories) {
      if (directories[dirName].results.length) {
        nonEmptyDirectories[dirName] = directories[dirName];
      }
    }
    if (!isEmpty(nonEmptyDirectories)) {
      filteredTree[serviceName] = {results: nonEmptyDirectories};
    }
  }
  return filteredTree;
}

export function flattenResults(
  resultsGroupedByService: GroupedResults,
): Array<ProviderResult> {
  const items = [];
  for (const serviceName in resultsGroupedByService) {
    for (const dirName in resultsGroupedByService[serviceName].results) {
      items.push(resultsGroupedByService[serviceName].results[dirName].results);
    }
  }
  return Array.prototype.concat.apply([], items);
}

export function getOuterResults(
  location: 'top' | 'bottom',
  resultsByService: GroupedResults,
): ?OuterResults {
  const nonEmptyResults = filterEmptyResults(resultsByService);
  const serviceNames = Object.keys(nonEmptyResults);
  const serviceName =
    location === 'top'
      ? serviceNames[0]
      : serviceNames[serviceNames.length - 1];
  if (serviceName == null) {
    return null;
  }
  const directoryNames = Object.keys(nonEmptyResults[serviceName].results);
  const directoryName =
    location === 'top'
      ? directoryNames[0]
      : directoryNames[directoryNames.length - 1];
  const results = nonEmptyResults[serviceName].results[directoryName].results;
  return {
    serviceName,
    directoryName,
    results,
  };
}
