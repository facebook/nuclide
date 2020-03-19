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

import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import * as React from 'react';
import type {IconName} from 'nuclide-commons-ui/Icon';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import featureConfig from 'nuclide-commons-atom/feature-config';

import ScrollableResults from 'nuclide-commons-ui/ScrollableResults';
import type FindReferencesModel from './FindReferencesModel';
import crypto from 'crypto';
import {Subject} from 'rxjs';

const FIND_REFERENCES_URI = 'atom://nuclide/find-references/';
const DEFAULT_LOCATION_SETTING =
  'atom-ide-find-references.defaultLocationForPane';
const DEFAULT_PANE_LOCATION: PaneLocation = 'bottom';

type PaneLocation = 'bottom' | 'center' | 'left' | 'right';

export class FindReferencesViewModel {
  _id: string;
  _model: FindReferencesModel;
  _controlsVisibleSubject: Subject<boolean> = new Subject();

  constructor(model: FindReferencesModel) {
    // Generate a unique ID for each panel.
    this._id = (crypto.randomBytes(8) || '').toString('hex') || '';
    this._model = model;
  }

  getTitle(): string {
    const symbol = this._model.getSymbolName();
    const title = this._model.getTitle();
    if (symbol.length > 0) {
      return `${title}: ${symbol}`;
    }
    return title;
  }

  getIconName(): IconName {
    return 'telescope';
  }

  getURI(): string {
    return FIND_REFERENCES_URI + this._id;
  }

  getDefaultLocation(): PaneLocation {
    const paneLocation = featureConfig.get(DEFAULT_LOCATION_SETTING);
    if (
      paneLocation === 'right' ||
      paneLocation === 'bottom' ||
      paneLocation === 'center' ||
      paneLocation === 'left'
    ) {
      return paneLocation;
    }
    return DEFAULT_PANE_LOCATION;
  }

  getElement(): HTMLElement {
    const BoundScrollableResults = bindObservableAsProps(
      this._controlsVisibleSubject.startWith(true).map(controlsVisible => ({
        count: this._model.getReferenceCount(),
        fileResultsCount: this._model.getFileCount(),
        exceededByteLimit: false,
        controlsVisible,
        onClick: (path, line, column) => goToLocation(path, {line, column}),
        onToggleControls: () =>
          this._controlsVisibleSubject.next(!controlsVisible),
        query: null,
        loadResults: (offset, limit) =>
          this._model.getFileResults(offset, limit),
      })),
      ScrollableResults,
    );
    return renderReactRoot(<BoundScrollableResults />);
  }
}
