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
import * as t from 'babel-types';
import generate from 'babel-generator';
import {generateProxy} from '../lib/proxy-generator';
import {addMatchers} from '../../nuclide-test-helpers';
import {parseServiceDefinition} from '../lib/service-parser';
import nuclideUri from 'nuclide-commons/nuclideUri';
import vm from 'vm';
import {__test__} from '../lib/proxy-generator';

import type {Type} from '../lib/types';

import {builtinLocation} from '../lib/builtin-types';

describe('Proxy generator test suite.', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  for (const file of fs.readdirSync(nuclideUri.join(__dirname, 'fixtures'))) {
    if (file.endsWith('.def')) {
      it(`Successfully generates proxy for ${file}`, () => {
        const fixturePath = nuclideUri.join(__dirname, 'fixtures', file);
        const definitions = parseServiceDefinition(
          file,
          fs.readFileSync(fixturePath, 'utf8'),
          [],
        );

        const code = generateProxy(
          nuclideUri.basename(file, '.def'),
          false,
          definitions,
        );
        const expected = fs.readFileSync(
          nuclideUri
            .join(__dirname, 'fixtures', file)
            .replace('.def', '.proxy'),
          'utf8',
        );
        expect(code.trim()).diffLines(expected.trim());
      });
    }
  }
});

const ArrayOfArrayOfNuclideUri: Type = {
  location: builtinLocation,
  kind: 'array',
  type: {
    location: builtinLocation,
    kind: 'array',
    type: {
      location: builtinLocation,
      kind: 'named',
      name: nuclideUri.NUCLIDE_URI_TYPE_NAME,
    },
  },
};

describe('generateTransformStatement helper function', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('Generates a marshal statement.', () => {
    const code = generate(
      __test__.generateTransformStatement(
        t.identifier('value'),
        ArrayOfArrayOfNuclideUri,
        true,
      ),
    ).code;
    expect(code).diffLines(marshalText);
  });

  it('Generates an unmarshal statement.', () => {
    const code = generate(
      __test__.generateTransformStatement(
        t.identifier('value'),
        ArrayOfArrayOfNuclideUri,
        false,
      ),
    ).code;
    expect(code).diffLines(unmarshalText);
  });
});

const marshalText = `_client.marshal(value, {
  location: {
    type: "builtin"
  },
  kind: "array",
  type: {
    location: {
      type: "builtin"
    },
    kind: "array",
    type: {
      location: {
        type: "builtin"
      },
      kind: "named",
      name: "NuclideUri"
    }
  }
})`;

const unmarshalText = `_client.unmarshal(value, {
  location: {
    type: "builtin"
  },
  kind: "array",
  type: {
    location: {
      type: "builtin"
    },
    kind: "array",
    type: {
      location: {
        type: "builtin"
      },
      kind: "named",
      name: "NuclideUri"
    }
  }
})`;

describe('objectToLiteral helper function', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('works on numbers', () => {
    expect(generate(__test__.objectToLiteral(1)).code).diffLines('1');
  });

  it('works on strings', () => {
    expect(generate(__test__.objectToLiteral('1')).code).diffLines('"1"');
  });

  it('works on booleans', () => {
    expect(generate(__test__.objectToLiteral(false)).code).diffLines('false');
  });

  it('works on Maps', () => {
    expect(generate(__test__.objectToLiteral(new Map())).code).diffLines(
      'new Map()',
    );
  });

  it('works on objects with simple keys', () => {
    expect(generate(__test__.objectToLiteral({a: 1})).code).diffLines(
      '{\n  a: 1\n}',
    );
  });

  it('works on objects with complex keys', () => {
    expect(generate(__test__.objectToLiteral({'.': 1})).code).diffLines(
      '{\n  ".": 1\n}',
    );
  });

  it('works on null', () => {
    expect(generate(__test__.objectToLiteral(null)).code).diffLines('null');
  });

  it('works on undefined', () => {
    expect(generate(__test__.objectToLiteral()).code).diffLines('undefined');
    expect(generate(__test__.objectToLiteral(undefined)).code).diffLines(
      'undefined',
    );
  });

  it('works on arrays', () => {
    expect(generate(__test__.objectToLiteral([])).code).diffLines('[]');
  });

  it('throws on unknown type function', () => {
    expect(() => {
      generate(__test__.objectToLiteral(() => {})).code;
    }).toThrow(new Error('Cannot convert unknown type function to literal.'));
  });

  it('throws on unknown type nested function', () => {
    expect(() => {
      generate(__test__.objectToLiteral({fn: () => {}})).code;
    }).toThrow(new Error('Cannot convert unknown type function to literal.'));
  });

  it('throws on unknown type class', () => {
    expect(() => {
      generate(__test__.objectToLiteral(class X {})).code;
      // Native classes also pass typeof === 'function'
    }).toThrow(new Error('Cannot convert unknown type function to literal.'));
  });

  it('works on nested objects', () => {
    const objValue = vm.runInThisContext(`(${objSrc})`);
    const actual = generate(__test__.objectToLiteral(objValue)).code;
    expect(actual).diffLines(objSrc);
  });
});

const objSrc = `\
{
  a: 1,
  b: true,
  c: null,
  d: undefined,
  f: [],
  g: {},
  j: new Map([["array", [false, {}, [0], new Map()]]]),
  ".": 1
}`;
