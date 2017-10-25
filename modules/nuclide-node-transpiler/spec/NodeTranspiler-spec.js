/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  rulesdir/no-commonjs: 0,
  */

const fs = require('fs');
const vm = require('vm');
const dedent = require('dedent');

const NodeTranspiler = require('../lib/NodeTranspiler');

describe('NodeTranspiler', () => {
  describe('NodeTranspiler.shouldCompile', () => {
    it('matches @flow', () => {
      [
        '/** @flow */\n',
        dedent`
          /**
           * @flow
           */
        `,
        dedent`
          /**
           * @foo
           * @flow
           */
        `,
      ].forEach(src => {
        expect(NodeTranspiler.shouldCompile(src)).toBe(true);
        expect(NodeTranspiler.shouldCompile(new Buffer(src))).toBe(true);
      });
    });

    it('ignores everything else', () => {
      [
        "'use strict';\n",
        '/** @fflow */\n',
        '/** flow */\n',
        dedent`
          'use strict';
          /**
           * @flow
           */
        `,
        dedent`
          'use strict';
          /**
           * @flow
           */
        `,
        // You have to strip your own shebang before the docblock is parsed!
        dedent`
          #!/usr/bin/env node
          /**
           * @flow
           */
        `,
      ].forEach(src => {
        expect(NodeTranspiler.shouldCompile(src)).toBe(false);
        expect(NodeTranspiler.shouldCompile(new Buffer(src))).toBe(false);
      });
    });
  });

  describe('NodeTranspiler#getConfigDigest', () => {
    it('works with real babel', () => {
      const realBabel = require('babel-core');
      const nodeTranspilerReal = new NodeTranspiler();

      const fakeBabel = {
        version: realBabel.version,
        transform() { throw new Error('This should not have been called.'); },
      };
      const nodeTranspilerFake =
        new NodeTranspiler(fakeBabel.version, () => fakeBabel);

      expect(nodeTranspilerReal.getConfigDigest())
        .toBe(nodeTranspilerFake.getConfigDigest());
    });
  });

  describe('NodeTranspiler#transform', () => {
    it('works on buffers', () => {
      const filename = require.resolve('./fixtures/modern-syntax');
      const nodeTranspiler = new NodeTranspiler();

      const bufferSrc = fs.readFileSync(filename);
      expect(Buffer.isBuffer(bufferSrc)).toBe(true);

      const out1 = nodeTranspiler.transform(bufferSrc, filename);
      expect(typeof out1).toBe('string');

      const c1 = {exports: {}};
      vm.runInNewContext(out1, c1);
      expect(c1.exports.Foo.bar).toBe('qux');
    });

    it('works on strings', () => {
      const filename = require.resolve('./fixtures/modern-syntax');
      const nodeTranspiler = new NodeTranspiler();

      const stringSrc = fs.readFileSync(filename, 'utf8');
      expect(typeof stringSrc).toBe('string');

      const out2 = nodeTranspiler.transform(stringSrc, filename);
      expect(typeof out2).toBe('string');

      const c2 = {exports: {}};
      vm.runInNewContext(out2, c2);
      expect(c2.exports.Foo.bar).toBe('qux');
    });
  });

  describe('NodeTranspiler#_getCacheFilename', () => {
    it('works', () => {
      const filename = require.resolve('./fixtures/modern-syntax');
      const nodeTranspiler = new NodeTranspiler();

      const bufferSrc = fs.readFileSync(filename);
      expect(Buffer.isBuffer(bufferSrc)).toBe(true);

      const cacheFilename1 =
        nodeTranspiler._getCacheFilename(bufferSrc, filename);
      const cacheFilename2 =
        nodeTranspiler._getCacheFilename(bufferSrc.toString(), filename);

      expect(cacheFilename1).toEqual(cacheFilename2);
    });
  });

  describe('NodeTranspiler#transformWithCache', () => {
    it('reads from the cache', () => {
      const filename = require.resolve('./fixtures/modern-syntax');
      const nodeTranspiler = new NodeTranspiler();

      nodeTranspiler._getCacheFilename = src => {
        expect(src).toBe('abc');
        return filename;
      };

      const out = nodeTranspiler.transformWithCache('abc', filename);
      const expected = fs.readFileSync(filename, 'utf8');

      expect(out).toBe(expected);
    });
  });
});
