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

export function capitalize(word: string): string {
  if (word.length === 0) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function compareStrings(one_: ?string, two_: ?string): number {
  const one = one_ || '';
  const two = two_ || '';
  return one.localeCompare(two, 'en', {sensitivity: 'base'});
}

export function compareStringsCapitalsLast(one: ?string, two: ?string): number {
  const byCapitalization =
    Number(isCapitalized(one || '')) - Number(isCapitalized(two || ''));
  return byCapitalization !== 0 ? byCapitalization : compareStrings(one, two);
}

export function compareStringsCapitalsFirst(
  one: ?string,
  two: ?string,
): number {
  const byCapitalization =
    Number(isCapitalized(two || '')) - Number(isCapitalized(one || ''));
  return byCapitalization !== 0 ? byCapitalization : compareStrings(one, two);
}

export function isCapitalized(name: string): boolean {
  return name.length > 0 && name.charAt(0).toLowerCase() !== name.charAt(0);
}

export function isLowerCase(name: string): boolean {
  return name.toLowerCase() === name;
}

export default {
  capitalize,
  compareStrings,
  compareStringsCapitalsFirst,
  compareStringsCapitalsLast,
  isCapitalized,
  isLowerCase,
};
