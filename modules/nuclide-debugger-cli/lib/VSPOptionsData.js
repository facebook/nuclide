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
import type {DebuggerConfigAction} from 'nuclide-debugger-common';

import idx from 'idx';
import fs from 'fs';
import {mapFromObject} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';

export type AdapterPropertyType =
  | 'string'
  | 'number'
  | 'array'
  | 'boolean'
  | 'object';

export type AdapterProperty = {
  // type may be missing for enumerated properties
  type?: string | string[],
  description?: string,
  default?: any,
  enum?: (string | boolean)[],
  // items contains the type for array elements; however, it isn't always
  // there even for array types.
  items?: {
    type: AdapterPropertyType,
  },
};

export type AdapterPropertyObject = {
  [string]: AdapterProperty,
};

export type AdapterPropertyMap = Map<string, AdapterProperty>;

export type AdapterActionSection = {
  required?: [string],
  properties: AdapterPropertyObject,
};

// The parts of a VSP adapter's package.json that we need in order to parse
// command line options.
export type AdapterConfiguration = {
  contributes: {
    debuggers: [
      {
        type: string,
        configurationAttributes: {
          [DebuggerConfigAction]: AdapterActionSection,
        },
      },
    ],
  },
};

export default class VSPOptionsData {
  _packagePath: string;
  _adapterConfiguration: AdapterConfiguration;
  _strings: ?Map<string, string>;

  constructor(packagePath: string) {
    this._packagePath = packagePath;

    const path = nuclideUri.join(this._packagePath, 'package.json');
    try {
      this._adapterConfiguration = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      throw new Error(
        `Adapter package.json for '${this._packagePath}' is corrupt.`,
      );
    }

    if (this._adapterConfiguration == null) {
      throw new Error(
        `Adapter package.json for '${this._packagePath}' is corrupt.`,
      );
    }

    // $TODO enumerate languages
    // Note that not all adapters will have this file; some have the
    // strings directly embedded in package.json
    const nlsPath = nuclideUri.join(this._packagePath, 'package.nls.json');
    try {
      const packageStrings: {[string]: string} = JSON.parse(
        fs.readFileSync(nlsPath, 'utf8'),
      );

      if (packageStrings != null) {
        this._strings = mapFromObject(packageStrings);
      }
    } catch (error) {}
  }

  adapterPropertiesForAction(
    type: string,
    action: DebuggerConfigAction,
  ): Map<string, AdapterProperty> {
    const propertyMap = this._propertiesFromConfig(
      this._adapterConfiguration,
      action,
      type,
    );

    for (const prop of propertyMap.values()) {
      const desc = this._translateDescription(prop.description);
      if (desc != null) {
        prop.description = desc;
      }
    }

    return propertyMap;
  }

  _propertiesFromConfig(
    config: AdapterConfiguration,
    action: DebuggerConfigAction,
    type: string,
  ): AdapterPropertyMap {
    const debuggers = idx(config, _ => _.contributes.debuggers) || null;
    if (debuggers == null) {
      throw new Error('Adapter package.json is missing.');
    }

    const theDebugger = debuggers.find(_ => _.type === type);
    const properties = idx(
      theDebugger,
      _ => _.configurationAttributes[action].properties,
    );
    if (properties != null) {
      return mapFromObject(properties);
    }

    throw new Error('Adapter configuration is missing.');
  }

  _translateDescription(description: ?string): ?string {
    if (description == null || this._strings == null) {
      return description;
    }

    const strings = this._strings;
    if (strings == null) {
      return description;
    }

    const match = description.match(/^%(.*)%$/);
    if (match == null) {
      return description;
    }
    return strings.get(match[1]) || description;
  }
}
