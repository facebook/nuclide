/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import fs from 'fs';
import * as t from '@babel/types';
import generate from '@babel/generator';
import createProxyGenerator from '../lib/proxy-generator';
import {parseServiceDefinition} from '../lib/service-parser';
import nuclideUri from 'nuclide-commons/nuclideUri';

const {generateProxy, __test__} = createProxyGenerator(t, generate);

import type {Type} from '../lib/types';

import {builtinLocation} from '../lib/builtin-types';

describe('Proxy generator test suite.', () => {
  for (const file of fs.readdirSync(
    nuclideUri.join(__dirname, '../__mocks__/fixtures'),
  )) {
    if (file.endsWith('.def')) {
      it(`Successfully generates proxy for ${file}`, () => {
        const fixturePath = nuclideUri.join(
          __dirname,
          '../__mocks__/fixtures',
          file,
        );
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
            .join(__dirname, '../__mocks__/fixtures', file)
            .replace('.def', '.proxy'),
          'utf8',
        );
        expect(code.trim()).toBe(expected.trim());
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
  it('Generates a marshal statement.', () => {
    const code = generate(
      __test__.generateTransformStatement(
        t.identifier('value'),
        ArrayOfArrayOfNuclideUri,
        true,
      ),
    ).code;
    expect(code).toBe(marshalText);
  });

  it('Generates an unmarshal statement.', () => {
    const code = generate(
      __test__.generateTransformStatement(
        t.identifier('value'),
        ArrayOfArrayOfNuclideUri,
        false,
      ),
    ).code;
    expect(code).toBe(unmarshalText);
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
  it('works on numbers', () => {
    expect(generate(__test__.objectToLiteral(1)).code).toBe('1');
  });

  it('works on strings', () => {
    expect(generate(__test__.objectToLiteral('1')).code).toBe('"1"');
  });

  it('works on booleans', () => {
    expect(generate(__test__.objectToLiteral(false)).code).toBe('false');
  });

  it('works on Maps', () => {
    expect(generate(__test__.objectToLiteral(new Map())).code).toBe(
      'new Map()',
    );
  });

  it('works on objects with simple keys', () => {
    expect(generate(__test__.objectToLiteral({a: 1})).code).toBe(
      '{\n  a: 1\n}',
    );
  });

  it('works on objects with complex keys', () => {
    expect(generate(__test__.objectToLiteral({'.': 1})).code).toBe(
      '{\n  ".": 1\n}',
    );
  });

  it('works on null', () => {
    expect(generate(__test__.objectToLiteral(null)).code).toBe('null');
  });

  it('works on undefined', () => {
    expect(generate(__test__.objectToLiteral()).code).toBe('undefined');
    expect(generate(__test__.objectToLiteral(undefined)).code).toBe(
      'undefined',
    );
  });

  it('works on arrays', () => {
    expect(generate(__test__.objectToLiteral([])).code).toBe('[]');
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
});
