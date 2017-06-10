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

import {uriToPath} from './helpers';

/**
 * A dbgp Frame after it is converted from XML to JSON:
 * {
 *   "$":{
 *     "where":"{main}",
 *     "level":"0",
 *     "type":"file",
 *     "filename":"file:///home/peterhal/test/dbgp/test-client.php",
 *     "lineno":"2"
 *   }
 * }
 */
type DbgpStackFrame = {
  $: {
    where: string,
    level: string,
    type: string,
    filename: string,
    lineno: string,
  },
};

type FrameLocation = {
  lineNumber: number,
  scriptId: string,
};

export function idOfFrame(frame: DbgpStackFrame): string {
  // TODO: Mangle in the transactionId of the most recent pause/status.
  return frame.$.level;
}

export function functionOfFrame(frame: DbgpStackFrame): string {
  return frame.$.where;
}

// Returns an absolute path
export function fileOfFrame(frame: DbgpStackFrame): string {
  return uriToPath(fileUrlOfFrame(frame));
}

export function fileUrlOfFrame(frame: DbgpStackFrame): string {
  return frame.$.filename;
}

export function locationOfFrame(frame: DbgpStackFrame): FrameLocation {
  return {
    // TODO: columnNumber: from cmdbegin/end
    lineNumber: Number(frame.$.lineno) - 1,
    scriptId: fileOfFrame(frame),
  };
}
