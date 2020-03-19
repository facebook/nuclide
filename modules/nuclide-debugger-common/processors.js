/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {MessageProcessor} from './types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nuclideUri from 'nuclide-commons/nuclideUri';

type PathMapper = (path: string) => string;

export function remoteToLocalProcessor(): MessageProcessor {
  return pathProcessor(path => nuclideUri.getPath(path));
}

export function localToRemoteProcessor(
  targetUri: NuclideUri,
): MessageProcessor {
  const hostname = nuclideUri.getHostname(targetUri);
  return pathProcessor(path => nuclideUri.createRemoteUri(hostname, path));
}

export function pathProcessor(pathMapper: PathMapper): MessageProcessor {
  return message => {
    processRequestsUris(message, pathMapper);
    processResponseUris(message, pathMapper);
    processEventsUris(message, pathMapper);
  };
}

function processRequestsUris(message: Object, pathMapper: PathMapper): void {
  if (message.type !== 'request') {
    return;
  }
  switch (message.command) {
    case 'setBreakpoints':
    case 'source':
      translateField(message, 'arguments.source.path', pathMapper);
      break;
  }
}

function processResponseUris(message: Object, pathMapper: PathMapper): void {
  if (message.type !== 'response') {
    return;
  }
  switch (message.command) {
    case 'setBreakpoints':
    case 'setFunctionBreakpoints':
      message.body.breakpoints.forEach(bp =>
        translateField(bp, 'source.path', pathMapper),
      );
      break;
    case 'stackTrace':
      message.body.stackFrames.forEach(frame =>
        translateField(frame, 'source.path', pathMapper),
      );
      break;
    case 'modules':
      message.body.modules.forEach(module =>
        translateField(module, 'path', pathMapper),
      );
      break;
    case 'loadedSources':
      message.body.sources.forEach(source =>
        translateField(source, 'path', pathMapper),
      );
      break;
  }
}

function processEventsUris(message: Object, pathMapper: PathMapper): void {
  if (message.type !== 'event') {
    return;
  }

  switch (message.event) {
    case 'output':
    case 'loadedSource':
      translateField(message, 'body.source.path', pathMapper);
      break;
    case 'breakpoint':
      translateField(message, 'body.breakpoint.source.path', pathMapper);
      break;
    case 'module':
      translateField(message, 'body.module.path', pathMapper);
      break;
  }
}

// Traverse the source `object` for a deeply nested field,
// then apply the `pathMapper` to that field, if existing.
function translateField(
  object: Object,
  fieldDescriptor: string,
  pathMapper: PathMapper,
): void {
  const fields = fieldDescriptor.split('.');
  let lastObj = {};
  const value = fields.reduce((child, field) => {
    if (child == null) {
      return null;
    } else {
      lastObj = child;
      return child[field];
    }
  }, object);
  if (value != null) {
    const [lastField] = fields.slice(-1);
    lastObj[lastField] = pathMapper((value: any));
  }
}
