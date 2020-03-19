/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

// Adapted from https://github.com/atom/underscore-plus/blob/master/src/underscore-plus.coffee

// TODO: Consider combining with the similar function in `./humanizeKeystoke.js`
function capitalize(word: string): string {
  if (!word) {
    return '';
  }
  return word[0].toUpperCase() + word.slice(1);
}

function undasherize(string: string): string {
  return string
    ? string
        .split('-')
        .map(capitalize)
        .join(' ')
    : '';
}

function humanizeEventName(eventName: string): string {
  const [namespace, event] = eventName.split(':');
  if (!event) {
    return undasherize(namespace);
  }
  const namespaceDoc = undasherize(namespace);
  const eventDoc = undasherize(event);

  return `${namespaceDoc}: ${eventDoc}`;
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = humanizeEventName;
