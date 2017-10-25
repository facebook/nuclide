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
import type {IconName} from 'nuclide-commons-ui/Icon';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import featureConfig from 'nuclide-commons-atom/feature-config';

import FindReferencesView from './view/FindReferencesView';
import type FindReferencesModel from './FindReferencesModel';
import crypto from 'crypto';

const FIND_REFERENCES_URI = 'atom://nuclide/find-references/';
const DEFAULT_LOCATION_SETTING =
  'atom-ide-find-references.defaultLocationForPane';
const DEFAULT_PANE_LOCATION: PaneLocation = 'bottom';

type PaneLocation = 'bottom' | 'center' | 'left' | 'right';

export class FindReferencesViewModel {
  _id: string;
  _model: FindReferencesModel;
  _element: HTMLElement;

  constructor(model: FindReferencesModel) {
    // Generate a unique ID for each panel.
    this._id = (crypto.randomBytes(8) || '').toString('hex') || '';
    this._model = model;
    this._element = renderReactRoot(<FindReferencesView model={this._model} />);
  }

  getTitle(): string {
    return 'Symbol References: ' + this._model.getSymbolName();
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
    return this._element;
  }
}
