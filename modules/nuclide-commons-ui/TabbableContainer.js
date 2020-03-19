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

/* eslint-env browser */

import React from 'react';
import invariant from 'assert';
import {Observable} from 'rxjs';
import tabbable from 'tabbable';
import classnames from 'classnames';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

type DefaultProps = {
  contained: boolean,
  focusOnMount: boolean,
};

type Props = {
  children?: React$Node,
  contained: boolean,
  focusOnMount: boolean,
  className?: string,
};

const TABBABLE_CLASS_NAME = 'nuclide-tabbable';

/**
 * Enables focusing between inputs with tab and shift-tab. Can also be used to
 * trap focus within the container by using the contained property.
 */
export default class TabbableContainer extends React.Component<Props> {
  _disposables: UniversalDisposable;
  _rootNode: ?HTMLDivElement;

  static defaultProps: DefaultProps = {
    contained: false,
    focusOnMount: true,
  };

  componentDidMount() {
    const rootNode = this._rootNode;
    invariant(rootNode != null);
    const {focusOnMount} = this.props;

    // If focus has been deliberately set inside the container, don't try
    // to override it
    if (focusOnMount && !rootNode.contains(document.activeElement)) {
      const tabbableElements = tabbable(rootNode);
      const firstTabbableElement = tabbableElements[0];
      if (firstTabbableElement instanceof HTMLElement) {
        firstTabbableElement.focus();
      }
    }

    this._disposables = new UniversalDisposable(
      Observable.fromEvent(rootNode, 'keydown').subscribe(
        (event: KeyboardEvent) => {
          if (event.altKey || event.ctrlKey || event.metaKey) {
            return;
          }

          if (event.key === 'Tab') {
            if (event.shiftKey) {
              focusPrevious();
            } else {
              focusNext();
            }
            event.preventDefault();
            event.stopPropagation();
          }
        },
      ),
    );
  }

  componentWillUnmount() {
    this._disposables.dispose();
  }

  render(): React$Node {
    return (
      <div
        className={classnames(TABBABLE_CLASS_NAME, this.props.className)}
        data-contained={this.props.contained}
        ref={node => (this._rootNode = node)}>
        {this.props.children}
      </div>
    );
  }
}

function focusNext(): void {
  const currentElement = getFocusedElement();
  if (!(currentElement instanceof HTMLElement)) {
    return;
  }
  const focusedTabIndex =
    currentElement.tabIndex >= 0 ? currentElement.tabIndex : -Infinity;

  let nextElement = null;
  let nextTabIndex = Infinity;
  let lowestElement = null;
  let lowestTabIndex = Infinity;

  let container = findParentElement(currentElement, element => {
    return element.classList.contains(TABBABLE_CLASS_NAME);
  });
  if (
    container instanceof HTMLElement &&
    container.dataset.contained === 'false'
  ) {
    container = null;
  }

  eachTabIndexedElement(
    currentElement,
    false /* reverse */,
    (element, tabIndex) => {
      if (tabIndex < lowestTabIndex) {
        lowestTabIndex = tabIndex;
        lowestElement = element;
      }

      if (focusedTabIndex <= tabIndex && tabIndex < nextTabIndex) {
        nextTabIndex = tabIndex;
        nextElement = element;
        if (focusedTabIndex === tabIndex || focusedTabIndex + 1 === tabIndex) {
          return true; // doneSearching
        }
      }

      return false; // doneSearching
    },
    container,
  );

  if (nextElement) {
    nextElement.focus();
  } else if (lowestElement) {
    lowestElement.focus();
  }
}

function focusPrevious(): void {
  const currentElement = getFocusedElement();
  if (!(currentElement instanceof HTMLElement)) {
    return;
  }
  const focusedTabIndex =
    currentElement.tabIndex >= 0 ? currentElement.tabIndex : Infinity;

  let previousElement = null;
  let previousTabIndex = -Infinity;
  let highestElement = null;
  let highestTabIndex = -Infinity;

  let container = findParentElement(currentElement, element => {
    return element.classList.contains(TABBABLE_CLASS_NAME);
  });
  if (
    container instanceof HTMLElement &&
    container.dataset.contained === 'false'
  ) {
    container = null;
  }

  eachTabIndexedElement(
    currentElement,
    true /* reverse */,
    (element, tabIndex) => {
      if (tabIndex > highestTabIndex) {
        highestTabIndex = tabIndex;
        highestElement = element;
      }

      if (focusedTabIndex >= tabIndex && tabIndex > previousTabIndex) {
        previousTabIndex = tabIndex;
        previousElement = element;
        if (focusedTabIndex === tabIndex || focusedTabIndex - 1 === tabIndex) {
          return true; // doneSearching
        }
      }

      return false; // doneSearching
    },
    container,
  );

  if (previousElement) {
    previousElement.focus();
  } else if (highestElement) {
    highestElement.focus();
  }
}

/**
 * Traverses all focusable elements for the next element to focus.
 * curentElement is where the traversal starts.
 * reverse determines whether to traverse backwards or forwards.
 * updateNextCandidate is a method that determines if the element is the best
 *                     candidate to be focused next. A boolean is returned to
 *                     stop the traversal if that element is guaranteed to be
 *                     the next candidate.
 * container is where all of the focusable elements are searched.
 *           Default value is document.
 */
function eachTabIndexedElement(
  currentElement: Element,
  reverse: boolean,
  updateNextCandidate: (element: Element, tabIndex: number) => boolean,
  container: ?Element,
): void {
  const elements = (container || document).querySelectorAll(
    'a, input, button, [tabindex]',
  );
  let index = Array.from(elements).indexOf(currentElement);
  const increment = reverse ? -1 : 1;
  for (let i = 1; i < elements.length; ++i) {
    index = (index + elements.length + increment) % elements.length;
    const element = elements[index];
    if (
      // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
      element.disabled === true ||
      element.tabIndex == null ||
      element.tabIndex < 0
    ) {
      continue;
    }
    if (updateNextCandidate(element, element.tabIndex)) {
      break;
    }
  }
}

function getFocusedElement(): ?Element {
  return document.activeElement;
}

/**
 * Finds a parent of currentElement that satisfies the condition.
 */
function findParentElement(
  currentElement: ?Element,
  condition: (element: Element) => boolean,
): ?Element {
  let element = currentElement;
  while (element && !condition(element)) {
    element = element.parentElement;
  }
  return element;
}
