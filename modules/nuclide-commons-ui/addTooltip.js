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

import * as React from 'react';
import ReactDOM from 'react-dom';
import shallowEqual from 'shallowequal';

const REREGISTER_DELAY = 100;

const _tooltipRequests: Map<Element, atom$TooltipsAddOptions> = new Map();
const _createdTooltips: WeakMap<
  Element,
  {options: atom$TooltipsAddOptions, disposable: IDisposable},
> = new WeakMap();
const _toDispose: Set<Element> = new Set();
let _timeoutHandle: ?TimeoutID;

/**
 * Adds a self-disposing Atom tooltip to a react element.
 *
 * Typical usage:
 * <div ref={addTooltip({title: 'My awesome tooltip', delay: 100, placement: 'top'})} />
 * or, if the ref needs to be preserved:
 * <div ref={c => {
 *   addTooltip({title: 'My awesome tooltip', delay: 100, placement: 'top'})(c);
 *   _myDiv = c;
 * }} />
 */
export default function addTooltip(
  options: atom$TooltipsAddOptions,
): (elementRef: React.ElementRef<any>) => void {
  let node: ?Element;

  return elementRef => {
    _scheduleTooltipMaintenance();

    if (elementRef == null) {
      if (node != null) {
        if (_tooltipRequests.has(node)) {
          _tooltipRequests.delete(node);
        } else {
          _toDispose.add(node);
        }
      }
      node = null;

      return;
    }

    node = ((ReactDOM.findDOMNode(elementRef): any): Element);
    _tooltipRequests.set(node, options);
  };
}

function _registrationUndoesDisposal(
  node: Element,
  options: atom$TooltipsAddOptions,
) {
  const created = _createdTooltips.get(node);
  if (created == null) {
    return false;
  }

  return shallowEqual(options, created.options);
}

function _scheduleTooltipMaintenance(): void {
  if (_timeoutHandle != null) {
    return;
  }

  _timeoutHandle = setTimeout(() => _performMaintenance(), REREGISTER_DELAY);
}

function _performMaintenance(): void {
  _timeoutHandle = null;

  for (const [node, options] of _tooltipRequests.entries()) {
    if (_registrationUndoesDisposal(node, options)) {
      _toDispose.delete(node);
      _tooltipRequests.delete(node);
    }
  }

  _toDispose.forEach(node => {
    const created = _createdTooltips.get(node);
    if (created != null) {
      created.disposable.dispose();
      _createdTooltips.delete(node);
    }
  });
  _toDispose.clear();

  for (const [node, options] of _tooltipRequests.entries()) {
    // $FlowIgnore
    const disposable = atom.tooltips.add(node, {
      keyBindingTarget: node,
      ...options,
    });

    _createdTooltips.set(node, {disposable, options});
  }
  _tooltipRequests.clear();
}
