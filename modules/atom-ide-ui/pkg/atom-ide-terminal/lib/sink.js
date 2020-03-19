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

import type {Terminal} from './types';

import invariant from 'assert';

// A Sink is a simplfiication of a writable stream.  This facilitates
// setting up a pipeline of transformations on a string stream in cases
// where there is no need to consider errors, buffering, encoding, or EOF.
export type Sink = string => void;

const TMUX_CONTROLCONTROL_PREFIX = '\x1BP1000p';

// Creates a pass-through Sink that skips over a literal prefix if present.
//
// Parameters:
//   prefix - literal prefix to match.
//   next - next Sink in the data processing chain.
export function removePrefixSink(prefix: string, next: Sink): Sink {
  let doneMatching = false;
  let matched = 0;
  return data => {
    if (doneMatching) {
      next(data);
      return;
    }
    // At this point we are still in the prefix.
    const limit = Math.min(prefix.length - matched, data.length);
    for (let i = 0; i < limit; i++) {
      if (data.charAt(i) !== prefix.charAt(matched + i)) {
        // Found a non-match.  Forward any partial match plus new data.
        doneMatching = true;
        next(prefix.slice(0, matched) + data);
        return;
      }
    }
    // At this point everything we have seen so far has matched.
    matched += limit;
    invariant(matched <= prefix.length);
    if (matched === prefix.length) {
      // Matched the whole prefix.  Remove prefix and forward remainder (if any).
      doneMatching = true;
      if (limit < data.length) {
        next(data.slice(limit));
      }
    }
  };
}

// Creates a pass-through Sink that calls a callback with the count of
// (possibly overlapping) matches of a pattern.
//
// Parameters:
//   pattern - sequence of characters to match.
//   notify - called each time a match occurs. This can return false to disable future notifications.
//   next - next Sink in the data processing chain.
export function patternCounterSink(
  pattern: string,
  notify: () => boolean,
  next: Sink,
): Sink {
  let enabled = true;
  let partial: Array<number> = [];
  let nextPartial: Array<number> = [];
  return data => {
    for (let i = 0; enabled && i < data.length; i++) {
      const dataCh = data.charAt(i);
      partial.push(0);
      while (enabled && partial.length > 0) {
        let patternIndex = partial.pop();
        const patternCh = pattern.charAt(patternIndex++);
        if (patternCh === dataCh) {
          if (patternIndex < pattern.length) {
            nextPartial.push(patternIndex);
          } else {
            enabled = notify();
          }
        }
      }
      [partial, nextPartial] = [nextPartial, partial];
    }
    next(data);
  };
}

export function createOutputSink(terminal: Terminal): Sink {
  let tmuxLines = 0;
  let lines = 0;
  let firstChar: ?string = null;
  let warned = false;
  return removePrefixSink(
    TMUX_CONTROLCONTROL_PREFIX,
    patternCounterSink(
      '\n%',
      n => ++tmuxLines < 2,
      patternCounterSink(
        '\n',
        n => ++lines < 2,
        data => {
          if (firstChar == null && data.length > 0) {
            firstChar = data.charAt(0);
          }
          if (
            firstChar === '%' &&
            tmuxLines === lines &&
            tmuxLines >= 2 &&
            !warned
          ) {
            warned = true;
            atom.notifications.addWarning('Tmux control protocol detected', {
              detail:
                'The terminal output looks like you might be using tmux with -C or -CC.  ' +
                'Nuclide terminal can be used with tmux, but not with the -C or -CC options.  ' +
                'In your ~/.bashrc or similar, you can avoid invocations of tmux -C (or -CC) ' +
                'in Nuclide terminal by checking:\n' +
                '  if [ "$TERM_PROGRAM" != nuclide ]; then\n' +
                '    tmux -C ...\n' +
                '  fi',
              dismissable: true,
            });
          }
          terminal.write(data);
        },
      ),
    ),
  );
}
