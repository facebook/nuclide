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

import {Observable} from 'rxjs';

const observerConfig = {
  childList: true,
  attributes: true,
  characterData: true,
  subtree: true,
  attributeOldValue: true,
  characterDataOldValue: true,
};

export type DOMMeasurements = {
  clientHeight: number,
  clientWidth: number,
  offsetHeight: number,
  offsetWidth: number,
  scrollHeight: number,
  scrollWidth: number,
};

function getElementDimensions(node: HTMLElement): DOMMeasurements {
  return {
    clientHeight: node.clientHeight,
    clientWidth: node.clientWidth,
    offsetHeight: node.offsetHeight,
    offsetWidth: node.offsetWidth,
    scrollHeight: node.scrollHeight,
    scrollWidth: node.scrollWidth,
  };
}

export function observeElementDimensions(
  node: HTMLElement,
): Observable<DOMMeasurements> {
  return Observable.create(observer => {
    observer.next(getElementDimensions(node));

    // eslint-disable-next-line no-undef
    const mutationObserver = new MutationObserver(() => {
      observer.next(getElementDimensions(node));
    });

    mutationObserver.observe(node, observerConfig);

    return mutationObserver.disconnect.bind(mutationObserver);
  }).distinctUntilChanged((dimensions1, dimensions2) => {
    for (const key in dimensions1) {
      if (dimensions1[key] !== dimensions2[key]) {
        return false;
      }
    }
    return true;
  });
}
