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

import invariant from 'assert';
import Ansi from 'nuclide-commons-ui/Ansi';
import {createStatus} from '../../commons-node/tasks';
import type {BuckEvent} from './BuckEventStream';
import type {TaskEvent} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import stripAnsi from 'strip-ansi';
import React from 'react';

const RESET_ANSI = '[?7l';

export class BuckConsoleParser {
  /**
   * _statusMemory is a memory structure used here to keep state across
   *  "status" events in order to construct full frame strings due to the
   *  nature of buck's serial output stream.
   */
  _statusMemory: {
    addedBuildTargetToTitle: boolean,
    title: string,
    body: Array<string>,
  } = {
    addedBuildTargetToTitle: false,
    title: '',
    body: [],
  };

  /*
   * _processStatusEvent recieves an ANSI-stripped line of Buck superconsole
   *  stdout as input with flags set by the ANSI. This function combines the
   *  _statusMemory to reconstruct the buck superconsole. State is also used
   *  for summarized title for the element. The TaskEvent we return contains:
   *  title: the summarized one-line info based on buck state (max len: 35)
   *  body: the combined stream inbetween reset flags which constitutes the
   *         state that the buck superconsole wants to represent.
   *
   * TODO refactor this logic into a react scoped class that can construct
   *  these as react elements.
   */
  processStatusEvent(event: BuckEvent): Observable<TaskEvent> {
    invariant(event != null && event.type === 'buck-status');

    const {message} = event;
    const reset = message.includes(RESET_ANSI);
    const stripped = stripAnsi(message);
    const mem = this._statusMemory;

    if (reset) {
      mem.addedBuildTargetToTitle = false;
      mem.body = [];
    }

    const PARSING_BUCK_FILES_REGEX = /(Pars.* )([\d:]+\d*\.?\d*)\s(min|sec)/g;
    const CREATING_ACTION_GRAPH_REGEX = /(Creat.* )([\d:]+\d*\.?\d*)\s(min|sec)/g;
    const BUILDING_REGEX = /(Buil.* )([\d:]+\d*\.?\d*)\s(min|sec)/g;
    const BUILD_TARGET_REGEX = /\s-\s.*\/(?!.*\/)(.*)\.\.\.\s([\d:]+\d*\.?\d*)\s(min|sec)/g;
    const STARTING_BUCK_REGEX = /(Starting.*)/g;

    /* We'll attempt to match the event.message to a few known regex matches,
     * otherwise we'll ignore it. When we find a match, we'll parse it for
     * length, markup, and set the title.
     */
    let match = PARSING_BUCK_FILES_REGEX.exec(stripped);
    if (match == null) {
      match = CREATING_ACTION_GRAPH_REGEX.exec(stripped);
    }
    if (match == null) {
      match = BUILDING_REGEX.exec(stripped);
    }
    if (match != null && match.length > 1) {
      let prefix = match[1];
      if (prefix.length > 24) {
        prefix = prefix.slice(0, 24);
      }
      mem.title = `${prefix}`;
    }
    /* this block parses the first subsequent Building... line
     * (i.e. " - fldr/com/facebook/someTarget:someTarget#header-info 2.3 sec")
     * into: "Building... someTarget:som 2.3 sec". & gates itself with addedBuildTargetToTitle
     */
    if (match == null && !mem.addedBuildTargetToTitle) {
      match = BUILD_TARGET_REGEX.exec(stripped);
      if (match != null) {
        let target = match[1].split('#')[0];
        if (target.length > 12) {
          target = target.slice(0, 12);
        }
        mem.title = `Building ../${target}`;
        mem.addedBuildTargetToTitle = true;
      }
    }

    if (match == null) {
      match = STARTING_BUCK_REGEX.exec(stripped);
      if (match != null) {
        let target = match[0];
        if (target.length > 35) {
          target = target.slice(0, 35);
        }
        mem.title = target;
      }
    }

    mem.body.push(message);

    if (mem.title !== '') {
      return createStatus('bulletin', {
        title: {message: mem.title},
        detail: (
          <>
            <Ansi>{mem.body.join('')}</Ansi>
          </>
        ),
      });
    }

    return Observable.empty();
  }
}
