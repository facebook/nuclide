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

// The MI documentation doesn't cover this, but gdb will return structured values
// for registers which contain packed arrays of simple types (MMX et al.)
// Furthermore, if the register can hold different widths of values, then
// there is an intermediate node for each possible representation it can hold.
//
// The syntax is similar to MI result record values:
// value => simple_value | named_list | indexed_list
// simple_value => float-value | integer-value
// named_list => '{' identifer '=' value ( ',' identifier '=' value ) * '}'
// indexed_list => '{' value ( ',' value ) *  '}'
//

import invariant from 'assert';

export type MINamedRegisterValue = {
  name: string,
  expressionSuffix: string,
  value: MIRegisterValue,
};

export class MIRegisterValue {
  toString(): string {
    return '';
  }

  isContainer(): boolean {
    return false;
  }

  containedValues(): Array<MINamedRegisterValue> {
    return [];
  }

  get containerKeyIsString(): boolean {
    return false;
  }

  get length(): number {
    return 0;
  }

  valueAt(index: string): ?MIRegisterValue {
    return null;
  }
}

export class MIRegisterSimpleValue extends MIRegisterValue {
  _value: string;

  constructor(value: string) {
    super();
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}

export class MIRegisterNamedValues extends MIRegisterValue {
  _values: Map<string, MIRegisterValue>;

  constructor(values: Map<string, MIRegisterValue>) {
    super();
    this._values = values;
  }

  isContainer(): boolean {
    return true;
  }

  get names(): Array<string> {
    return [...this._values.keys()];
  }

  get containerKeyIsString(): boolean {
    return true;
  }

  get length(): number {
    return this._values.size;
  }

  valueAt(index: string): ?MIRegisterValue {
    return this._values.get(index);
  }

  containedValues(): Array<MINamedRegisterValue> {
    return [...this._values].map(entry => {
      return {
        name: entry[0],
        expressionSuffix: `.${entry[0]}`,
        value: entry[1],
      };
    });
  }

  toString(): string {
    return `{${[...this._values]
      .map(([k, v]) => `${k}:${v.toString()}`)
      .join(',')}}`;
  }
}

export class MIRegisterIndexedValues extends MIRegisterValue {
  _values: Array<MIRegisterValue>;

  constructor(values: Array<MIRegisterValue>) {
    super();
    this._values = values;
  }

  isContainer(): boolean {
    return true;
  }

  get length(): number {
    return this._values.length;
  }

  valueAt(index: string): ?MIRegisterValue {
    return this._values[parseInt(index, 10)];
  }

  get values(): Array<MIRegisterValue> {
    return this._values;
  }

  containedValues(): Array<MINamedRegisterValue> {
    return this._values.map((entry, index) => {
      return {
        name: `${index}`,
        expressionSuffix: `[${index}]`,
        value: entry,
      };
    });
  }

  toString(): string {
    return `[${this._values.map(_ => _.toString()).join(',')}]`;
  }
}

export class MIRegisterValueParser {
  _originalExpression: string;
  _expression: string;

  // matches name = something
  _namePattern: RegExp = /^\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*=(.*)/;

  constructor(expression: string) {
    this._originalExpression = expression;
  }

  parse(): MIRegisterValue {
    this._expression = this._originalExpression;

    const value = this._parse();
    if (this._expression !== '') {
      throw new Error('Extra characters at end of expression');
    }
    return value;
  }

  _parse(): MIRegisterValue {
    this._expression = this._expression.trim();

    if (this._expression === '') {
      throw new Error('Premature end of register value expression');
    }

    if (this._expression[0] !== '{') {
      // expression value goes until the next ',', '}', or end of string.
      const match = this._expression.match(/^([^,}]*)(.*)$/);
      invariant(match != null);

      const [, value, rest] = match;

      this._expression = rest;
      return new MIRegisterSimpleValue(value.trim());
    }

    this._expression = this._expression.substr(1);

    // if we have "name = " then we have a named list; otherwise, an indexed
    // list.
    if (this._expression.match(this._namePattern) != null) {
      return this._parseNamedList();
    }

    return this._parseIndexedList();
  }

  _parseIndexedList(): MIRegisterValue {
    const values: Array<MIRegisterValue> = [];

    while (true) {
      const value = this._parse();

      if (!this._expandArrayInto(value, values)) {
        values.push(value);
      }
      if (this._checkEndOfList()) {
        break;
      }
    }

    return new MIRegisterIndexedValues(values);
  }

  // gdb/MI will sometimes reformat an array if it contains multiple repeated
  // values. This is great for saving space in displayable output, but we want
  // the expansion to be available to be expanded in tree display.
  _expandArrayInto(
    value: MIRegisterValue,
    values: Array<MIRegisterValue>,
  ): boolean {
    if (value instanceof MIRegisterSimpleValue) {
      const repeatedValuePattern = /^(.*) <repeats (\d+) times>$/;
      const match = value.value.match(repeatedValuePattern);
      if (match != null) {
        const [, repeatedValue, countStr] = match;
        const count = parseInt(countStr, 10);
        for (let i = 0; i < count; i++) {
          values.push(new MIRegisterSimpleValue(repeatedValue));
        }
        return true;
      }
    }

    return false;
  }

  _parseNamedList(): MIRegisterValue {
    const values: Map<string, MIRegisterValue> = new Map();

    while (true) {
      const match = this._expression.match(this._namePattern);
      if (match != null) {
        const [, name, rest] = match;
        this._expression = rest;
        const value = this._parse();

        values.set(name, value);
        continue;
      }

      if (this._checkEndOfList()) {
        break;
      }
    }

    return new MIRegisterNamedValues(values);
  }

  _checkEndOfList(): boolean {
    this._expression = this._expression.trim();
    if (this._expression !== '') {
      const sepChar = this._expression[0];
      this._expression = this._expression.substr(1);

      if (sepChar === '}') {
        return true;
      } else if (sepChar === ',') {
        return false;
      }
    }
    throw new Error('Improperly formatted list in register value');
  }
}
