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

import fs from 'fs';
import {addMatchers} from '../../nuclide-test-helpers';
import {parseServiceDefinition, _clearFileParsers} from '../lib/service-parser';
import {stripLocationsFileName} from '../lib/location';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('Nuclide service parser test suite.', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  afterEach(() => {
    _clearFileParsers();
  });

  for (const file of fs.readdirSync(nuclideUri.join(__dirname, 'fixtures'))) {
    if (file.endsWith('.def')) {
      it(`Successfully parses ${file}`, () => {
        const fixturePath = nuclideUri.join(__dirname, 'fixtures', file);
        const code = fs.readFileSync(fixturePath, 'utf8');
        const expected = JSON.parse(
          fs.readFileSync(
            nuclideUri.join(__dirname, 'fixtures', file) + '.json',
            'utf8',
          ),
        );
        const definitions = parseServiceDefinition(fixturePath, code, []);
        stripLocationsFileName(definitions);
        expect(definitions).diffJson(expected);
      });
    }
  }

  it('duplicate global definitions throw', () => {
    const code = `
      export function f(): void {}
      export class f {
        m(): void {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('duplicate member definitions throw', () => {
    const code = `
      export class f {
        m(): void {}
        m(): void {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Invalid dispose arguments throw', () => {
    const code = `
      export class f {
        dispose(x: int): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Invalid dispose return type throw', () => {
    const code = `
      export class f {
        dispose(): int {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Missing dispose throw', () => {
    const code = `
      export class f {
        m(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Missing type definitions throw', () => {
    const code = `
      export class f {
        m(): Promise<MissingType> {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('More missing type definitions throw', () => {
    const code = `
      export class f {
        static m(): ConnectableObservable<Map<string, {f: [string, ?Set<Array<MissingType>>]}>> {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Missing types in functions throw', () => {
    const code = `
      export type UsesMissingType = {
        f: MissingType;
      };
      export function f(p: UsesMissingType): void {}
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Missing types in ctor args throw', () => {
    const code = `
      export class C {
        constructor(p: MissingType) {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('User defined type conflicting with builtin', () => {
    const code = `
      export class Object {
        constructor() {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Promise may only be a return type', () => {
    const code = `
      export class C {
        constructor(p: Promise<string>) {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Observable may only be a return type', () => {
    const code = `
      export class C {
        m(p: Array<ConnectableObservable<number>>): void {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('void may only be a return type', () => {
    const code = `
      export class C {
        m(p: void): void {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Constructors may not have return types', () => {
    const code = `
      export class C {
        constructor(): Promise<void> {}
        dispose(): void {}
      }`;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Aliases cannot be recursive', () => {
    const code = `
      export type R = R;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Aliases cannot be recursive throw constructed types', () => {
    const code = `
      export type R = Promise<R>;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Aliases cannot be mutually recursive', () => {
    const code = `
      export type A = B;
      export type B = A;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Complex Aliases cannot be mutually recursive', () => {
    const code = `
      export type A = Promise<T>;
      export type T = [O];
      export type O = {f: A};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Return types must be promise/observable/void', () => {
    const code = `
      export type A = number;
      export function f(): A {};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Missing type in union throws', () => {
    const code = `
      export type A = B | 42;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Recursion in union throws', () => {
    const code = `
      export type A = 42 | A;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Promise in union throws', () => {
    const code = `
      export type A = 42 | Promise<42>;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Non-literal in union throws', () => {
    const code = `
      export type A = 42 | number;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Duplicate alternates in union throws', () => {
    const code = `
      export type A = 42 | 42;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Mismatched alternates in object union throws', () => {
    const code = `
      export type A = {kind: 'foo'} | '42';
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('No valid alternates in object union throws', () => {
    const code = `
      export type A = {kind: 'foo'} | {kind: string};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('No common discriminants in object union throws', () => {
    const code = `
      export type A = {kind1: 'foo'} | {kind2: 'bar'};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('Duplicate values in discriminant in object union throws', () => {
    const code = `
      export type A = {kind: 'foo'} | {kind: 'foo'};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('allows intersections', () => {
    const code = `
      export type A = {x: string} & {y: string};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).not.toThrow();
  });

  it('disallows intersections of non-object types', () => {
    const code = `
      export type A = {x: string} & boolean;
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('disallows intersections with overlapping fields', () => {
    const code = `
      export type A = {x: string} & {x: string};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('importing type aliases not supported', () => {
    const code = `
      import type {A as T} from 'foo';
      export f(p: T): void {};
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('allows params with default values', () => {
    const code = `
      export function f(x: number = 1): void {}
    `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).not.toThrow();
  });

  it('interfaces must include a dispose', () => {
    const code = `
      export interface I {
        f(): Promise<string>,
      };
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('allow interfaces', () => {
    const code = `
      export interface I {
        f(): Promise<string>,
        dispose(): void,
      };
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).not.toThrow();
  });

  it('function typed fields are not supported', () => {
    const code = `
      export type T = {
        formatAtPosition?: () => Promise<string>,
      };
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('optional methods in classes are not supported', () => {
    const code = `
      export class C {

          formatAtPosition?: () => Promise<string> = null,

          dispose(): void {}
      };
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });

  it('optional methods in interfaces are not supported', () => {
    const code = `
      export interface I {

          formatAtPosition?: () => Promise<string>,

          dispose(): void,
      };
      `;
    expect(() => {
      parseServiceDefinition('fileName', code, []);
    }).toThrow();
  });
});
