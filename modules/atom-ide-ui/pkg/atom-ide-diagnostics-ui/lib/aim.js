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

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';

type Point = {x: number, y: number};

const VECTOR_DURATION = 100;

const distance = (a: Point, b: Point): number => {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
};

const eventToPoint = (e: MouseEvent): Point => ({
  x: e.clientX,
  y: e.clientY,
});

// Combine mouseenter and mouseleave to create an observable of hovering state.
function areHovering(
  element: HTMLElement,
  editorElement: atom$TextEditorElement,
): Observable<boolean> {
  return Observable.merge(
    Observable.fromEvent(element, 'mouseenter').mapTo(true),
    Observable.fromEvent(element, 'mouseleave').mapTo(false),
    editorScrolled(editorElement).mapTo(false),
  );
}

function findCorners(node: HTMLElement): [Point, Point, Point, Point] {
  const {left, width, top, height} = node.getBoundingClientRect();
  return [
    {x: left, y: top}, // Top left
    {x: left + width, y: top}, // Top right
    {x: left, y: top + height}, // Bottom left
    {x: left + width, y: top + height}, // Bottom right
  ];
}

function areAiming(from: HTMLElement, to: HTMLElement): Observable<boolean> {
  const [topLeft, topRight, bottomLeft, bottomRight] = findCorners(to);

  const toBelowFrom =
    to.getBoundingClientRect().top >= from.getBoundingClientRect().bottom;

  // For now we assume that `to` is always to the right of `from` and that
  // `from` is always strictly above or below `to`. A more robust solution would
  // be to find the two corner of `to` that form the largest angle from the
  // center of `from`
  const [cornerA, cornerB] = toBelowFrom
    ? [topRight, bottomLeft]
    : [topLeft, bottomRight];

  return Observable.fromEvent(document, 'mousemove')
    .map(eventToPoint)
    .auditTime(VECTOR_DURATION)
    .map(mouse => distance(mouse, cornerA) + distance(mouse, cornerB))
    .pairwise()
    .map(([prevDist, currentDist]) => prevDist > currentDist)
    .distinctUntilChanged();
}

function editorScrolled(
  editorElement: atom$TextEditorElement,
): Observable<number> {
  return observableFromSubscribeFunction(cb =>
    editorElement.onDidChangeScrollTop(cb),
  );
}

export function hoveringOrAiming(
  from: HTMLElement,
  to: HTMLElement,
  editorElement: atom$TextEditorElement,
): Observable<boolean> {
  return Observable.concat(
    areHovering(from, editorElement)
      .startWith(true)
      .takeWhile(Boolean),
    Observable.combineLatest(
      areAiming(from, to).startWith(true),
      areHovering(to, editorElement).startWith(false),
      editorScrolled(editorElement)
        .mapTo(true)
        .startWith(false),
      (aiming, hovering, scrolled) => {
        return (aiming || hovering) && !scrolled;
      },
    ),
  ).distinctUntilChanged();
}
