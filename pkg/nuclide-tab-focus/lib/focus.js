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

/* eslint-env browser */

import {_TABBABLE_CLASS_NAME} from 'nuclide-commons-ui/TabbableContainer';

export function focusNext(): void {
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
    return element.classList.contains(_TABBABLE_CLASS_NAME);
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

export function focusPrevious(): void {
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
    return element.classList.contains(_TABBABLE_CLASS_NAME);
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
      element.disabled === true ||
      element.tabIndex == null ||
      element.tabIndex === -1
    ) {
      continue;
    }
    if (updateNextCandidate(element, element.tabIndex)) {
      break;
    }
  }
}

function getFocusedElement(): ?Element {
  // Some inputs have a hidden-input with tabindex = -1 that gets focused, so
  // activeElement is actually not what we want. In these cases, we must find
  // the parent tag that has the actual tabindex to use. An example is the
  // atom-text-editor.
  let currentElement = document.activeElement;
  if (currentElement && currentElement.classList.contains('hidden-input')) {
    currentElement = findParentElement(
      currentElement.parentElement,
      element => element instanceof HTMLElement && element.tabIndex >= 0,
    );
  }
  return currentElement;
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
