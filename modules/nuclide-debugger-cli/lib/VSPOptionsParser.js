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

import type {
  AdapterProperty,
  AdapterPropertyMap,
  AdapterPropertyType,
} from './VSPOptionsData';

import type {DebuggerConfigAction} from 'nuclide-debugger-common';

import idx from 'idx';
import invariant from 'assert';
import {mapFilter, mapTransform} from 'nuclide-commons/collection';
import VSPOptionsData from './VSPOptionsData';
import yargs from 'yargs';

export type CustomArgumentType = {
  typeDescription: string,
  parseType: AdapterPropertyType,
  parser: any => any,
};

export type CustomArgumentMap = Map<string, CustomArgumentType>;

export default class VSPOptionsParser {
  _optionsData: VSPOptionsData;

  constructor(packagePath: string) {
    this._optionsData = new VSPOptionsData(packagePath);
  }

  get optionsData(): VSPOptionsData {
    return this._optionsData;
  }

  commandLineHelp(
    type: string,
    action: DebuggerConfigAction,
    exclude: Set<string>,
    customArguments: CustomArgumentMap,
  ): Array<string> {
    let help = [];
    const custom = customArguments == null ? new Map() : customArguments;

    const properties: Map<
      string,
      AdapterProperty,
    > = this._optionsData.adapterPropertiesForAction(type, action);

    const optionKeys = Array.from(properties.keys())
      .filter(_ => !exclude.has(_))
      .sort();

    for (const optionKey of optionKeys) {
      const property = properties.get(optionKey);
      if (property != null) {
        help = help.concat(this._helpFor(optionKey, property, custom));
      }
    }

    return help;
  }

  _helpFor(
    optionKey: string,
    property: AdapterProperty,
    customArguments: CustomArgumentMap,
  ): Array<string> {
    const help = [];

    const description = property.description;
    if (description != null && description !== '') {
      let spec = '';
      const validValues = property.enum;
      let type = property.type;
      const custom = customArguments.get(optionKey);

      if (validValues != null) {
        spec = validValues.map(_ => `'${_.toString()}'`).join('|');
      } else if (custom != null) {
        spec = custom.typeDescription;
      } else if (type != null) {
        if (!Array.isArray(type)) {
          type = [type];
        }
        const itemType = idx(property, _ => _.items.type) || null;
        spec = type.map(_ => this._typeToDisplay(_, itemType)).join('|');
      }

      help.push(`--${optionKey}: ${spec}\n`);

      const maxLineLength = 80;
      const prefix = '  ';

      let line = prefix;
      for (const word of description.split(/\s+/)) {
        if (line === prefix) {
          line = `${line}${word}`;
        } else {
          const newLine = `${line} ${word}`;
          if (newLine.length <= maxLineLength) {
            line = newLine;
          } else {
            help.push(line);
            line = `${prefix}${word}`;
          }
        }
      }
      if (line !== '') {
        help.push(line);
      }
    }

    return help;
  }

  _typeToDisplay(type: string, itemType: ?string): string {
    switch (type) {
      case 'boolean':
        return "'true'|'false'";
      case 'object':
        return 'json';
      case 'array':
        const innerType = itemType == null ? 'arg' : itemType;
        return `${innerType} ${innerType} ...`;
    }

    return type;
  }

  parseCommandLine(
    type: string,
    action: DebuggerConfigAction,
    exclude: Set<string>,
    includeDefaults: Set<string>,
    customArguments: CustomArgumentMap,
  ): Map<string, any> {
    const propertyMap = this._optionsData.adapterPropertiesForAction(
      type,
      action,
    );

    let args = mapFilter(
      propertyMap,
      (name, prop) => prop.default != null && name in includeDefaults,
    );
    args = mapTransform(args, (prop, name) => [name, prop.default]);

    const parser = this._yargsFromPropertyMap(propertyMap, customArguments);

    this._applyCommandLineToArgs(
      args,
      parser.argv,
      propertyMap,
      customArguments,
    );

    return args;
  }

  // $TODO better flow typing for yargs
  _yargsFromPropertyMap(
    propertyMap: AdapterPropertyMap,
    customArguments: CustomArgumentMap,
  ): Object {
    let parser = yargs;

    for (const [name, prop] of propertyMap) {
      // If an enum is specified, it gives a list of valid choices, so don't
      // worry about the type
      const validValues = prop.enum;
      if (Array.isArray(validValues)) {
        parser = parser.choices(name, validValues.map(_ => _.toString()));
        continue;
      }

      const custom = customArguments.get(name);
      const propType = custom != null ? custom.parseType : prop.type;

      if (propType == null) {
        // if enums and type are both missing, then the prop is busted.
        continue;
      }

      if (Array.isArray(propType)) {
        // If it could be multiple things, figure it out later.
        parser = parser.string(name);
        continue;
      }

      if (propType === 'array') {
        parser = parser.array(name);
        continue;
      }

      if (propType === 'boolean') {
        parser = parser.boolean(name);
        continue;
      }

      parser = parser.string(name);
    }

    return parser;
  }

  _applyCommandLineToArgs(
    args: Map<string, any>,
    commandLine: {[string]: any},
    propertyMap: AdapterPropertyMap,
    customArguments: CustomArgumentMap,
  ) {
    for (const [name, prop] of propertyMap) {
      const value = commandLine[name];
      if (value == null) {
        continue;
      }

      const validValues = prop.enum;
      if (Array.isArray(validValues)) {
        // yargs will have already validated the value.
        args.set(name, value);
        continue;
      }

      const custom = customArguments.get(name);
      if (custom != null) {
        const customValue = custom.parser(value);
        args.set(name, customValue);
        continue;
      }

      const type = prop.type;
      invariant(type != null);

      switch (type) {
        case 'number':
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            throw new Error(`Value of option --${name} must be numeric.`);
          }
          args.set(name, num);
          break;

        case 'boolean':
          args.set(name, value);
          break;

        case 'object':
          let objectData = {};
          try {
            // $TODO this is hard to get right on the command line, find a better way
            objectData = JSON.parse(value);
          } catch (error) {
            throw new Error(`Value of option --${name} must be valid JSON.`);
          }
          args.set(name, objectData);
          break;

        default:
          args.set(name, value);
      }
    }
  }
}
