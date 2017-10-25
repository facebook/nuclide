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

import nuclideUri, {__TEST__} from '../nuclideUri';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';

describe('nuclide-uri', () => {
  const localUri = '/usr/local/file';
  const badRemoteUriNoPath = 'nuclide://fb.com';
  const atomUri = 'atom://bla/bla';
  const remoteUri = nuclideUri.createRemoteUri('fb.com', '/usr/local');
  const remoteUriWithSpaces = nuclideUri.createRemoteUri('fb.com', '/a b/c d');
  const remoteUriWithHashes = nuclideUri.createRemoteUri(
    'fb.co.uk',
    '/ab/#c.d  #',
  );
  const localArchiveUri = '/etc/file.zip!a';
  const remoteArchiveUri = nuclideUri.createRemoteUri(
    'fb.com',
    '/file.zip!a.txt',
  );
  const endsWithExclamationUri = '/module/!! WARNING !!';
  const archiveSuffixUri = '/etc/file.zip!';

  it('isRemote', () => {
    expect(nuclideUri.isRemote('/')).toBe(false);
    expect(nuclideUri.isRemote(remoteUri)).toBe(true);
    expect(nuclideUri.isRemote(atomUri)).toBe(false);
    expect(nuclideUri.isRemote(localArchiveUri)).toBe(false);
    expect(nuclideUri.isRemote(remoteArchiveUri)).toBe(true);
    expect(nuclideUri.isRemote(endsWithExclamationUri)).toBe(false);
  });

  it('isLocal', () => {
    expect(nuclideUri.isLocal('/')).toBe(true);
    expect(nuclideUri.isLocal(remoteUri)).toBe(false);
    expect(nuclideUri.isLocal('C:\\abc')).toBe(true);
    expect(nuclideUri.isLocal(atomUri)).toBe(false);
    expect(nuclideUri.isLocal(localArchiveUri)).toBe(true);
    expect(nuclideUri.isLocal(remoteArchiveUri)).toBe(false);
    expect(nuclideUri.isLocal(endsWithExclamationUri)).toBe(true);
  });

  it('createRemoteUri', () => {
    expect(remoteUri).toBe('nuclide://fb.com/usr/local');
    expect(remoteUriWithSpaces).toBe('nuclide://fb.com/a b/c d');
    expect(remoteArchiveUri).toBe('nuclide://fb.com/file.zip!a.txt');
  });

  it('join', () => {
    expect(nuclideUri.join.bind(null, badRemoteUriNoPath, '../foo')).toThrow();
    expect(nuclideUri.join('/usr/local', 'bin')).toBe('/usr/local/bin');
    expect(nuclideUri.join(remoteUri, 'bin')).toBe(
      'nuclide://fb.com/usr/local/bin',
    );
    expect(nuclideUri.join(localArchiveUri, 'b.txt')).toBe(
      '/etc/file.zip!a/b.txt',
    );
    expect(nuclideUri.join(endsWithExclamationUri, 'b.txt')).toBe(
      '/module/!! WARNING !!/b.txt',
    );
    expect(nuclideUri.join('/usr/local', '..')).toBe('/usr');
    expect(nuclideUri.join(remoteUri, '..')).toBe('nuclide://fb.com/usr');
    expect(() => nuclideUri.join(atomUri)).toThrow();
    expect(() => nuclideUri.join(archiveSuffixUri)).toThrow();
  });

  it('archiveJoin', () => {
    expect(nuclideUri.archiveJoin('/file.zip', 'a.txt')).toBe(
      '/file.zip!a.txt',
    );
    expect(() => nuclideUri.archiveJoin(atomUri, 'a.txt')).toThrow();
    expect(() => nuclideUri.archiveJoin(archiveSuffixUri, 'a.txt')).toThrow();
    expect(() => nuclideUri.archiveJoin('/dir', 'a.txt')).toThrow();
  });

  describe('parsing remote', () => {
    it('handles simple paths', () => {
      expect(nuclideUri.getHostname(remoteUri)).toBe('fb.com');
      expect(nuclideUri.getPath(remoteUri)).toBe('/usr/local');
    });

    it('does not encode space characters', () => {
      expect(nuclideUri.getHostname(remoteUriWithSpaces)).toBe('fb.com');
      expect(nuclideUri.getPath(remoteUriWithSpaces)).toBe('/a b/c d');
    });

    it('treats hash symbols as literals, part of the path', () => {
      const parsedUri = nuclideUri.parse(remoteUriWithHashes);
      expect(parsedUri.hostname).toBe('fb.co.uk');
      expect(parsedUri.path).toBe('/ab/#c.d  #');
    });

    it('throws when given an illegal URI', () => {
      expect(() => nuclideUri.getHostname(atomUri)).toThrow();
      expect(() => nuclideUri.getPath(atomUri)).toThrow();
      expect(() => nuclideUri.parse(atomUri)).toThrow();
      expect(() => nuclideUri.getHostname(archiveSuffixUri)).toThrow();
      expect(() => nuclideUri.getPath(archiveSuffixUri)).toThrow();
      expect(() => nuclideUri.parse(archiveSuffixUri)).toThrow();
    });
  });

  it('parsing local', () => {
    expect(() => nuclideUri.getHostname(localUri)).toThrow();
    expect(() => nuclideUri.getHostname(localArchiveUri)).toThrow();
    expect(nuclideUri.getPath(localUri)).toBe(localUri);
    expect(nuclideUri.getPath(localArchiveUri)).toBe(localArchiveUri);
    expect(nuclideUri.getPath(remoteArchiveUri)).toBe('/file.zip!a.txt');
    expect(nuclideUri.getPath(endsWithExclamationUri)).toBe(
      endsWithExclamationUri,
    );
    expect(() => nuclideUri.getPath('nuclide://host/archive.zip!')).toThrow();
    expect(() => nuclideUri.parseRemoteUri(localUri)).toThrow();
  });

  it('basename', () => {
    expect(nuclideUri.basename('/')).toBe('');
    expect(nuclideUri.basename('/abc')).toBe('abc');
    expect(nuclideUri.basename('/abc/')).toBe('abc');
    expect(nuclideUri.basename('/abc/def')).toBe('def');
    expect(nuclideUri.basename('/abc/def/')).toBe('def');

    expect(nuclideUri.basename('nuclide://host/')).toBe('');
    expect(nuclideUri.basename('nuclide://host/abc')).toBe('abc');
    expect(nuclideUri.basename('nuclide://host/abc/')).toBe('abc');
    expect(nuclideUri.basename('nuclide://host/abc/def')).toBe('def');
    expect(nuclideUri.basename('nuclide://host/abc/def/')).toBe('def');
    expect(nuclideUri.basename('nuclide://host/a c/d f')).toBe('d f');

    expect(nuclideUri.basename('/z.zip!abc')).toBe('abc');
    expect(nuclideUri.basename('/z.zip!abc/')).toBe('abc');
    expect(nuclideUri.basename('/z.zip!abc/def')).toBe('def');
    expect(nuclideUri.basename('/abc/def!ghi')).toBe('def!ghi');
    expect(nuclideUri.basename('/abc/def.txt!ghi')).toBe('def.txt!ghi');

    expect(nuclideUri.basename('nuclide://host/z.zip!abc')).toBe('abc');
    expect(nuclideUri.basename('nuclide://host/z.zip!abc/')).toBe('abc');
    expect(nuclideUri.basename('nuclide://host/z.zip!abc/def')).toBe('def');

    expect(nuclideUri.basename('C:\\')).toBe('');
    expect(nuclideUri.basename('C:\\abc')).toBe('abc');
    expect(nuclideUri.basename('C:\\abc\\')).toBe('abc');
    expect(nuclideUri.basename('C:\\abc\\def')).toBe('def');
    expect(nuclideUri.basename('C:\\abc\\def\\')).toBe('def');
    expect(nuclideUri.basename('\\abc\\def')).toBe('def');
    expect(nuclideUri.basename('\\abc\\def\\')).toBe('def');

    expect(nuclideUri.basename('C:\\z.zip!abc')).toBe('abc');
    expect(nuclideUri.basename('C:\\z.zip!abc\\')).toBe('abc');
    expect(nuclideUri.basename('C:\\z.zip!abc\\def')).toBe('def');
    expect(nuclideUri.basename('C:\\abc\\def!ghi')).toBe('def!ghi');
    expect(nuclideUri.basename('C:\\abc\\def.txt!ghi')).toBe('def.txt!ghi');
    expect(nuclideUri.basename('\\z.zip!abc')).toBe('abc');
    expect(nuclideUri.basename('\\z.zip!abc\\')).toBe('abc');
    expect(nuclideUri.basename('\\z.zip!abc\\def')).toBe('def');
    expect(nuclideUri.basename('\\abc\\def!ghi')).toBe('def!ghi');
    expect(nuclideUri.basename('\\abc\\def.txt!ghi')).toBe('def.txt!ghi');

    expect(() => nuclideUri.basename(atomUri)).toThrow();
    expect(() => nuclideUri.basename(archiveSuffixUri)).toThrow();
  });

  it('dirname', () => {
    expect(nuclideUri.dirname('/')).toBe('/');
    expect(nuclideUri.dirname('/abc')).toBe('/');
    expect(nuclideUri.dirname('/abc/')).toBe('/');
    expect(nuclideUri.dirname('/abc/def')).toBe('/abc');
    expect(nuclideUri.dirname('/abc/def/')).toBe('/abc');

    expect(nuclideUri.dirname('nuclide://host/')).toBe('nuclide://host/');
    expect(nuclideUri.dirname('nuclide://host/abc')).toBe('nuclide://host/');
    expect(nuclideUri.dirname('nuclide://host/abc/')).toBe('nuclide://host/');
    expect(nuclideUri.dirname('nuclide://host/abc/def')).toBe(
      'nuclide://host/abc',
    );
    expect(nuclideUri.dirname('nuclide://host/abc/def/')).toBe(
      'nuclide://host/abc',
    );
    expect(nuclideUri.dirname('nuclide://host/a c/d f')).toBe(
      'nuclide://host/a c',
    );

    expect(nuclideUri.dirname('/z.zip!abc')).toBe('/z.zip');
    expect(nuclideUri.dirname('/z.zip!abc/')).toBe('/z.zip');
    expect(nuclideUri.dirname('/z.zip!abc/def')).toBe('/z.zip!abc');
    expect(nuclideUri.dirname('/abc/def!ghi')).toBe('/abc');
    expect(nuclideUri.dirname('/abc/def.txt!ghi')).toBe('/abc');

    expect(nuclideUri.dirname('nuclide://host/z.zip!abc')).toBe(
      'nuclide://host/z.zip',
    );
    expect(nuclideUri.dirname('nuclide://host/z.zip!abc/')).toBe(
      'nuclide://host/z.zip',
    );
    expect(nuclideUri.dirname('nuclide://host/z.zip!abc/def')).toBe(
      'nuclide://host/z.zip!abc',
    );

    expect(nuclideUri.dirname('C:\\')).toBe('C:\\');
    expect(nuclideUri.dirname('C:\\abc')).toBe('C:\\');
    expect(nuclideUri.dirname('C:\\abc\\')).toBe('C:\\');
    expect(nuclideUri.dirname('C:\\abc\\def')).toBe('C:\\abc');
    expect(nuclideUri.dirname('C:\\abc\\def\\')).toBe('C:\\abc');
    expect(nuclideUri.dirname('\\abc\\def')).toBe('\\abc');
    expect(nuclideUri.dirname('\\abc\\def\\')).toBe('\\abc');

    expect(nuclideUri.dirname('C:\\z.zip!abc')).toBe('C:\\z.zip');
    expect(nuclideUri.dirname('C:\\z.zip!abc/')).toBe('C:\\z.zip');
    expect(nuclideUri.dirname('C:\\z.zip!abc/def')).toBe('C:\\z.zip!abc');
    expect(nuclideUri.dirname('C:\\abc\\def!ghi')).toBe('C:\\abc');
    expect(nuclideUri.dirname('C:\\abc\\def.txt!ghi')).toBe('C:\\abc');
    expect(nuclideUri.dirname('\\z.zip!abc')).toBe('\\z.zip');
    expect(nuclideUri.dirname('\\z.zip!abc/')).toBe('\\z.zip');
    expect(nuclideUri.dirname('\\z.zip!abc/def')).toBe('\\z.zip!abc');
    expect(nuclideUri.dirname('\\abc\\def!ghi')).toBe('\\abc');
    expect(nuclideUri.dirname('\\abc\\def.txt!ghi')).toBe('\\abc');

    expect(() => nuclideUri.dirname(atomUri)).toThrow();
    expect(() => nuclideUri.dirname(archiveSuffixUri)).toThrow();
  });

  it('extname', () => {
    expect(nuclideUri.extname('/abc')).toBe('');
    expect(nuclideUri.extname('/abc.')).toBe('.');
    expect(nuclideUri.extname('/abc.txt')).toBe('.txt');
    expect(nuclideUri.extname('/abc/def.html')).toBe('.html');
    expect(nuclideUri.extname('/abc/def/')).toBe('');
    expect(nuclideUri.extname('/abc/def.dir/')).toBe('.dir');

    expect(nuclideUri.extname('nuclide://host/')).toBe('');
    expect(nuclideUri.extname('nuclide://host/abc')).toBe('');
    expect(nuclideUri.extname('nuclide://host/abc.txt')).toBe('.txt');
    expect(nuclideUri.extname('nuclide://host/abc.')).toBe('.');
    expect(nuclideUri.extname('nuclide://host/abc/')).toBe('');
    expect(nuclideUri.extname('nuclide://host/abc/def')).toBe('');
    expect(nuclideUri.extname('nuclide://host/abc/def.js')).toBe('.js');

    expect(nuclideUri.extname('/z.zip!abc')).toBe('');
    expect(nuclideUri.extname('/z.zip!abc.zip')).toBe('.zip');
    expect(nuclideUri.extname('/abc.txt!def')).toBe('.txt!def');

    expect(nuclideUri.extname('C:\\')).toBe('');
    expect(nuclideUri.extname('C:\\abc')).toBe('');
    expect(nuclideUri.extname('C:\\abc\\')).toBe('');
    expect(nuclideUri.extname('C:\\abc.')).toBe('.');
    expect(nuclideUri.extname('C:\\abc.js')).toBe('.js');
    expect(nuclideUri.extname('C:\\abc\\def')).toBe('');
    expect(nuclideUri.extname('C:\\abc\\def\\')).toBe('');
    expect(nuclideUri.extname('C:\\abc\\def.')).toBe('.');
    expect(nuclideUri.extname('C:\\abc\\def.html')).toBe('.html');
    expect(nuclideUri.extname('\\abc\\def')).toBe('');
    expect(nuclideUri.extname('\\abc\\def.dir\\')).toBe('.dir');
    expect(nuclideUri.extname('\\abc\\def.')).toBe('.');
    expect(nuclideUri.extname('\\abc\\def.xml')).toBe('.xml');

    expect(nuclideUri.extname('C:\\z.zip!abc')).toBe('');
    expect(nuclideUri.extname('C:\\z.zip!abc.zip')).toBe('.zip');
    expect(nuclideUri.extname('C:\\abc.txt!def')).toBe('.txt!def');
    expect(nuclideUri.extname('\\z.zip!abc')).toBe('');
    expect(nuclideUri.extname('\\z.zip!abc.zip')).toBe('.zip');
    expect(nuclideUri.extname('\\abc.txt!def')).toBe('.txt!def');

    expect(() => nuclideUri.extname(atomUri)).toThrow();
    expect(() => nuclideUri.extname(archiveSuffixUri)).toThrow();
  });

  it('getParent', () => {
    expect(nuclideUri.getParent(localUri)).toBe('/usr/local');
    expect(nuclideUri.getParent(remoteUri)).toBe('nuclide://fb.com/usr');
    expect(nuclideUri.getParent('/etc/file.zip!a')).toBe('/etc/file.zip');
    expect(nuclideUri.getParent(localArchiveUri)).toBe('/etc/file.zip');
    expect(nuclideUri.getParent(remoteArchiveUri)).toBe(
      'nuclide://fb.com/file.zip',
    );
    expect(nuclideUri.getParent(endsWithExclamationUri)).toBe('/module');
    expect(nuclideUri.getParent('/abc/def!ghi')).toBe('/abc');
    expect(() => nuclideUri.getParent(atomUri)).toThrow();
    expect(() => nuclideUri.getParent(archiveSuffixUri)).toThrow();
  });

  it('contains', () => {
    expect(nuclideUri.contains('/usr/local', localUri)).toBe(true);
    expect(nuclideUri.contains('nuclide://fb.com/usr', remoteUri)).toBe(true);
    expect(nuclideUri.contains('/foo/bar/', '/foo/bar/abc.txt')).toBe(true);
    expect(nuclideUri.contains('/foo/bar', '/foo/bar/')).toBe(true);
    expect(nuclideUri.contains('/foo/bar/', '/foo/bar/')).toBe(true);
    expect(nuclideUri.contains('/foo/bar/', '/foo/bar')).toBe(true);

    expect(nuclideUri.contains('/z.zip', '/z.zip!abc')).toBe(true);
    expect(
      nuclideUri.contains(
        'nuclide://fb.com/z.zip',
        'nuclide://fb.com/z.zip!abc',
      ),
    ).toBe(true);
    expect(nuclideUri.contains('/z.zip!abc', '/z.zip!abc/def')).toBe(true);
    expect(
      nuclideUri.contains(
        'nuclide://fb.com/z.zip!abc',
        'nuclide://fb.com/z.zip!abc/def',
      ),
    ).toBe(true);
    expect(nuclideUri.contains('/abc', '/abc!def')).toBe(false);

    expect(() => nuclideUri.contains(atomUri, '/foo/bar')).toThrow();
    expect(() => nuclideUri.contains('/foo/bar', atomUri)).toThrow();
    expect(() => nuclideUri.contains(archiveSuffixUri, '/foo/bar')).toThrow();
    expect(() => nuclideUri.contains('/foo/bar', archiveSuffixUri)).toThrow();
  });

  it('collapse', () => {
    expect(nuclideUri.collapse(['/a', '/b'])).toEqual(['/a', '/b']);
    expect(nuclideUri.collapse(['/a/b/c/d', '/a', '/a/b'])).toEqual(['/a']);
    expect(nuclideUri.collapse(['/a', '/a/b', '/a/b/c'])).toEqual(['/a']);
    expect(
      nuclideUri.collapse(['/a/b.zip', '/a/b.zip!c', '/a/b.zip!c/d']),
    ).toEqual(['/a/b.zip']);
    expect(
      nuclideUri.collapse(['/a/b.zip!c', '/a/b.zip!c/d', '/a/b.zip!c/d/e']),
    ).toEqual(['/a/b.zip!c']);
    expect(
      nuclideUri.collapse(['/a/c', '/a/c/d', '/a/b', '/a/b/c/d/e']),
    ).toEqual(['/a/c', '/a/b']);
    expect(nuclideUri.collapse(['/a/be', '/a/b'])).toEqual(['/a/be', '/a/b']);
    expect(
      nuclideUri.collapse([
        'nuclide://fb.com/usr/local',
        'nuclide://fb.com/usr/local/test',
        'nuclide://facebook.com/usr/local/test',
      ]),
    ).toEqual([
      'nuclide://fb.com/usr/local',
      'nuclide://facebook.com/usr/local/test',
    ]);
  });

  it('normalize', () => {
    expect(nuclideUri.normalize(localUri)).toBe(localUri);
    expect(nuclideUri.normalize(remoteUri)).toBe(remoteUri);
    expect(nuclideUri.normalize.bind(null, badRemoteUriNoPath)).toThrow();
    expect(nuclideUri.normalize('/usr/local/..')).toBe('/usr');
    expect(nuclideUri.normalize('nuclide://fb.com/usr/local/..')).toBe(
      'nuclide://fb.com/usr',
    );
    expect(nuclideUri.normalize('/a b/c d/..')).toBe('/a b');
    expect(nuclideUri.normalize('/a/b.zip!c/..')).toBe('/a/b.zip');
    expect(nuclideUri.normalize('/a/b.zip!c/d/../../..')).toBe('/a');
    expect(nuclideUri.normalize('/a/b!c/..')).toBe('/a');
    expect(() => nuclideUri.normalize(atomUri)).toThrow();
    expect(() => nuclideUri.normalize(archiveSuffixUri)).toThrow();
  });

  it('relative', () => {
    expect(() => nuclideUri.relative(localUri, remoteUri)).toThrow();
    expect(nuclideUri.relative(nuclideUri.dirname(remoteUri), remoteUri)).toBe(
      'local',
    );
    expect(nuclideUri.relative(remoteUri, nuclideUri.dirname(remoteUri))).toBe(
      '..',
    );
    expect(
      nuclideUri.relative(
        nuclideUri.dirname(remoteUriWithSpaces),
        remoteUriWithSpaces,
      ),
    ).toBe('c d');
    expect(
      nuclideUri.relative(
        remoteUriWithSpaces,
        nuclideUri.dirname(remoteUriWithSpaces),
      ),
    ).toBe('..');
    expect(nuclideUri.relative(nuclideUri.dirname(localUri), localUri)).toBe(
      'file',
    );
    expect(nuclideUri.relative(localUri, nuclideUri.dirname(localUri))).toBe(
      '..',
    );
    expect(
      nuclideUri.relative(nuclideUri.dirname(localArchiveUri), localArchiveUri),
    ).toBe('a');
    expect(
      nuclideUri.relative(localArchiveUri, nuclideUri.dirname(localArchiveUri)),
    ).toBe('..');
    expect(
      nuclideUri.relative(
        nuclideUri.dirname(endsWithExclamationUri),
        endsWithExclamationUri,
      ),
    ).toBe('!! WARNING !!');
    expect(
      nuclideUri.relative(
        endsWithExclamationUri,
        nuclideUri.dirname(endsWithExclamationUri),
      ),
    ).toBe('..');
    expect(nuclideUri.relative('/a/b.zip!c', '/a/b.zip!d')).toBe('../d');
    expect(nuclideUri.relative('/a/b!c', '/a/b!d')).toBe('../b!d');
    expect(() => nuclideUri.relative(atomUri, 'foo')).toThrow();
    expect(() => nuclideUri.relative(archiveSuffixUri, 'foo')).toThrow();
  });

  it('nuclideUriToDisplayString', () => {
    expect(nuclideUri.nuclideUriToDisplayString(localUri)).toBe(localUri);
    expect(nuclideUri.nuclideUriToDisplayString(remoteUri)).toBe(
      'fb.com:/usr/local',
    );
    expect(nuclideUri.nuclideUriToDisplayString(localArchiveUri)).toBe(
      '/etc/file.zip!a',
    );
    expect(nuclideUri.nuclideUriToDisplayString(remoteArchiveUri)).toBe(
      'fb.com:/file.zip!a.txt',
    );
    expect(nuclideUri.nuclideUriToDisplayString(endsWithExclamationUri)).toBe(
      '/module/!! WARNING !!',
    );
    expect(() => nuclideUri.nuclideUriToDisplayString(atomUri)).toThrow();
    expect(() =>
      nuclideUri.nuclideUriToDisplayString(archiveSuffixUri),
    ).toThrow();
  });

  describe('isRoot', () => {
    it('plain posix root', () => expect(nuclideUri.isRoot('/')).toBe(true));
    it('double root', () => expect(nuclideUri.isRoot('//')).toBe(false));
    it('/abc', () => expect(nuclideUri.isRoot('/abc')).toBe(false));
    it('abc', () => expect(nuclideUri.isRoot('abc')).toBe(false));
    it('abc/def', () => expect(nuclideUri.isRoot('abc/def')).toBe(false));
    it('/file.zip!', () =>
      expect(() => nuclideUri.isRoot('/file.zip!')).toThrow());
    it('/file.zip!abc', () =>
      expect(nuclideUri.isRoot('/file.zip!abc')).toBe(false));
    it('remote root', () =>
      expect(nuclideUri.isRoot('nuclide://host/')).toBe(true));
    it('remote root with port', () =>
      expect(nuclideUri.isRoot('nuclide://host/')).toBe(true));
    it('remote non-root', () =>
      expect(nuclideUri.isRoot('nuclide://host/abc')).toBe(false));
    it('remote non-root no port', () => {
      expect(nuclideUri.isRoot('nuclide://host/abc')).toBe(false);
    });
    it('win diskless root', () => expect(nuclideUri.isRoot('\\')).toBe(true));
    it('win diskless double root', () =>
      expect(nuclideUri.isRoot('\\\\')).toBe(false));
    it('win diskless non-root', () =>
      expect(nuclideUri.isRoot('\\abc')).toBe(false));
    it('win diskful root', () => expect(nuclideUri.isRoot('C:\\')).toBe(true));
    it('win diskful double root', () =>
      expect(nuclideUri.isRoot('C:\\\\')).toBe(false));
    it('win diskful non-root', () =>
      expect(nuclideUri.isRoot('C:\\abc')).toBe(false));

    it('win relative', () => expect(nuclideUri.isRoot('abc\\def')).toBe(false));

    it('throws on illegal URIs', () => {
      expect(() => nuclideUri.basename(atomUri)).toThrow();
      expect(() => nuclideUri.basename(archiveSuffixUri)).toThrow();
    });
  });

  it('adds a proper suffix when needed', () => {
    expect(nuclideUri.ensureTrailingSeparator('/')).toBe('/');
    expect(nuclideUri.ensureTrailingSeparator('/abc')).toBe('/abc/');
    expect(nuclideUri.ensureTrailingSeparator('/abc/')).toBe('/abc/');
    expect(nuclideUri.ensureTrailingSeparator('/abc/def')).toBe('/abc/def/');
    expect(nuclideUri.ensureTrailingSeparator('/abc/def/')).toBe('/abc/def/');
    expect(nuclideUri.ensureTrailingSeparator('nuclide://host')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.ensureTrailingSeparator('nuclide://host/')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.ensureTrailingSeparator('nuclide://host/abc')).toBe(
      'nuclide://host/abc/',
    );
    expect(nuclideUri.ensureTrailingSeparator('nuclide://host/abc/def')).toBe(
      'nuclide://host/abc/def/',
    );
    expect(nuclideUri.ensureTrailingSeparator('nuclide://host/abc/def/')).toBe(
      'nuclide://host/abc/def/',
    );
    expect(nuclideUri.ensureTrailingSeparator('C:\\')).toBe('C:\\');
    expect(nuclideUri.ensureTrailingSeparator('C:\\abc')).toBe('C:\\abc\\');
    expect(nuclideUri.ensureTrailingSeparator('C:\\abc\\')).toBe('C:\\abc\\');
    expect(nuclideUri.ensureTrailingSeparator('C:\\abc\\def')).toBe(
      'C:\\abc\\def\\',
    );
    expect(nuclideUri.ensureTrailingSeparator('C:\\abc\\def\\')).toBe(
      'C:\\abc\\def\\',
    );
    expect(nuclideUri.ensureTrailingSeparator('\\abc\\def')).toBe(
      '\\abc\\def\\',
    );
    expect(nuclideUri.ensureTrailingSeparator('\\abc\\def\\')).toBe(
      '\\abc\\def\\',
    );
    expect(() => nuclideUri.ensureTrailingSeparator(atomUri)).toThrow();
    expect(() =>
      nuclideUri.ensureTrailingSeparator(archiveSuffixUri),
    ).toThrow();
  });

  it('properly removes suffix when needed', () => {
    expect(nuclideUri.trimTrailingSeparator('/')).toBe('/');
    expect(nuclideUri.trimTrailingSeparator('//')).toBe('/');
    expect(nuclideUri.trimTrailingSeparator('/abc')).toBe('/abc');
    expect(nuclideUri.trimTrailingSeparator('/abc/')).toBe('/abc');
    expect(nuclideUri.trimTrailingSeparator('/abc/def')).toBe('/abc/def');
    expect(nuclideUri.trimTrailingSeparator('/abc/def/')).toBe('/abc/def');
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host//')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host//')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/abc')).toBe(
      'nuclide://host/abc',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/abc/')).toBe(
      'nuclide://host/abc',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/abc/def')).toBe(
      'nuclide://host/abc/def',
    );
    expect(nuclideUri.trimTrailingSeparator('nuclide://host/abc/def/')).toBe(
      'nuclide://host/abc/def',
    );
    expect(nuclideUri.trimTrailingSeparator('C:\\')).toBe('C:\\');
    expect(nuclideUri.trimTrailingSeparator('C:\\\\')).toBe('C:\\');
    expect(nuclideUri.trimTrailingSeparator('C:\\abc')).toBe('C:\\abc');
    expect(nuclideUri.trimTrailingSeparator('C:\\abc\\')).toBe('C:\\abc');
    expect(nuclideUri.trimTrailingSeparator('C:\\abc\\def')).toBe(
      'C:\\abc\\def',
    );
    expect(nuclideUri.trimTrailingSeparator('C:\\abc\\def\\')).toBe(
      'C:\\abc\\def',
    );
    expect(nuclideUri.trimTrailingSeparator('\\')).toBe('\\');
    expect(nuclideUri.trimTrailingSeparator('\\\\')).toBe('\\');
    expect(nuclideUri.trimTrailingSeparator('\\abc\\def')).toBe('\\abc\\def');
    expect(nuclideUri.trimTrailingSeparator('\\abc\\def\\')).toBe('\\abc\\def');
    expect(() => nuclideUri.trimTrailingSeparator(atomUri)).toThrow();
    expect(() => nuclideUri.trimTrailingSeparator(archiveSuffixUri)).toThrow();
  });

  it('isAbsolute', () => {
    expect(nuclideUri.isAbsolute('/abc')).toBe(true);
    expect(nuclideUri.isAbsolute('/abc/def')).toBe(true);
    expect(nuclideUri.isAbsolute('nuclide://host/')).toBe(true);
    expect(nuclideUri.isAbsolute('nuclide://host/abc')).toBe(true);
    expect(nuclideUri.isAbsolute('nuclide://host/abc/def')).toBe(true);

    expect(nuclideUri.isAbsolute('C:\\abc')).toBe(true);
    expect(nuclideUri.isAbsolute('C:\\abc\\def')).toBe(true);
    expect(nuclideUri.isAbsolute('\\abc')).toBe(true);
    expect(nuclideUri.isAbsolute('\\abc\\def')).toBe(true);

    expect(nuclideUri.isAbsolute('abc')).toBe(false);
    expect(nuclideUri.isAbsolute('abc/def')).toBe(false);

    expect(nuclideUri.isAbsolute('abc\\def')).toBe(false);
    expect(() => nuclideUri.isAbsolute(atomUri)).toThrow();
    expect(() => nuclideUri.isAbsolute(archiveSuffixUri)).toThrow();
  });

  it('resolve', () => {
    expect(nuclideUri.resolve('/abc')).toBe('/abc');
    expect(nuclideUri.resolve('/abc', '..')).toBe('/');
    expect(nuclideUri.resolve('/abc', '..', '..')).toBe('/');
    expect(nuclideUri.resolve('/abc', '../..')).toBe('/');

    expect(nuclideUri.resolve('/abc/def')).toBe('/abc/def');
    expect(nuclideUri.resolve('/abc/def', 'ghi')).toBe('/abc/def/ghi');
    expect(nuclideUri.resolve('/abc/def', '..', 'ghi')).toBe('/abc/ghi');
    expect(nuclideUri.resolve('/abc/def', '../ghi')).toBe('/abc/ghi');
    expect(nuclideUri.resolve('/abc/def', '/ghi')).toBe('/ghi');

    expect(nuclideUri.resolve('/z.zip!abc')).toBe('/z.zip!abc');
    expect(nuclideUri.resolve('/z.zip!abc', '..')).toBe('/z.zip');
    expect(nuclideUri.resolve('/z.zip!abc', '..', '..')).toBe('/');
    expect(nuclideUri.resolve('/z.zip!abc', '../..')).toBe('/');

    expect(nuclideUri.resolve('/z.zip!abc', 'def')).toBe('/z.zip!abc/def');
    expect(nuclideUri.resolve('/z.zip!abc', '..', 'def')).toBe('/z.zip!def');
    expect(nuclideUri.resolve('/z.zip!abc', '../def')).toBe('/z.zip!def');
    expect(nuclideUri.resolve('/z.zip!abc', '/def')).toBe('/def');

    expect(nuclideUri.resolve('/dir/file!abc')).toBe('/dir/file!abc');
    expect(nuclideUri.resolve('/dir/file!abc', '..')).toBe('/dir');
    expect(nuclideUri.resolve('/dir/file!abc', '..', '..')).toBe('/');
    expect(nuclideUri.resolve('/dir/file!abc', '../..')).toBe('/');

    expect(nuclideUri.resolve('/dir/file!abc', 'def')).toBe(
      '/dir/file!abc/def',
    );
    expect(nuclideUri.resolve('/dir/file!abc', '..', 'def')).toBe('/dir/def');
    expect(nuclideUri.resolve('/dir/file!abc', '../def')).toBe('/dir/def');
    expect(nuclideUri.resolve('/dir/file!abc', '/def')).toBe('/def');

    expect(nuclideUri.resolve('nuclide://host/')).toBe('nuclide://host/');
    expect(nuclideUri.resolve('nuclide://host/', '..')).toBe('nuclide://host/');
    expect(nuclideUri.resolve('nuclide://host/abc')).toBe('nuclide://host/abc');
    expect(nuclideUri.resolve('nuclide://host/abc', '..')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.resolve('nuclide://host/abc', '..', '..')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.resolve('nuclide://host/abc', '../..')).toBe(
      'nuclide://host/',
    );
    expect(nuclideUri.resolve('nuclide://host/abc/def', 'ghi')).toBe(
      'nuclide://host/abc/def/ghi',
    );
    expect(nuclideUri.resolve('nuclide://host/abc/def', '../ghi')).toBe(
      'nuclide://host/abc/ghi',
    );
    expect(nuclideUri.resolve('nuclide://host/abc/def', '..', 'ghi')).toBe(
      'nuclide://host/abc/ghi',
    );
    expect(nuclideUri.resolve('nuclide://host/abc/def', '/ghi')).toBe(
      'nuclide://host/ghi',
    );

    expect(nuclideUri.resolve('C:\\abc')).toBe('C:\\abc');
    expect(nuclideUri.resolve('C:\\abc', '..')).toBe('C:\\');
    expect(nuclideUri.resolve('C:\\abc', '..', '..')).toBe('C:\\');
    expect(nuclideUri.resolve('C:\\abc', '..\\..')).toBe('C:\\');
    expect(nuclideUri.resolve('C:\\abc', 'def')).toBe('C:\\abc\\def');
    expect(nuclideUri.resolve('C:\\abc', '..\\def')).toBe('C:\\def');
    expect(nuclideUri.resolve('C:\\abc', '..', 'def')).toBe('C:\\def');

    expect(nuclideUri.resolve('\\abc', 'def')).toBe('\\abc\\def');
    expect(nuclideUri.resolve('\\abc', '..\\def')).toBe('\\def');
    expect(nuclideUri.resolve('\\abc', '..', 'def')).toBe('\\def');
    expect(() => nuclideUri.resolve(atomUri, '..')).toThrow();
  });

  describe('expandHomeDir()', () => {
    it('expands ~ to HOME', () => {
      expect(nuclideUri.expandHomeDir('~')).toBe(process.env.HOME);
    });

    it('expands ~/ to HOME', () => {
      const HOME = process.env.HOME;
      expect(HOME).not.toBeNull();
      expect(nuclideUri.expandHomeDir('~/abc')).toBe(
        path.posix.join(HOME, 'abc'),
      );
    });

    it('keeps ~def to ~def', () => {
      expect(nuclideUri.expandHomeDir('~def')).toBe('~def');
    });

    it('throws on illegal URIs', () => {
      expect(() => nuclideUri.expandHomeDir(atomUri)).toThrow();
      expect(() => nuclideUri.expandHomeDir(archiveSuffixUri)).toThrow();
    });
  });

  it('detects Windows and Posix paths properly', () => {
    expect(__TEST__._pathModuleFor('/')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('/abc')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('/abc/def')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('/abc.txt')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('nuclide://host')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('nuclide://host/')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('nuclide://host/abc')).toEqual(path.posix);
    expect(__TEST__._pathModuleFor('nuclide://host/abc/def')).toEqual(
      path.posix,
    );
    expect(__TEST__._pathModuleFor('nuclide://host/abc/def.txt')).toEqual(
      path.posix,
    );
    expect(__TEST__._pathModuleFor('C:\\')).toEqual(path.win32);
    expect(__TEST__._pathModuleFor('C:\\abc')).toEqual(path.win32);
    expect(__TEST__._pathModuleFor('C:\\abc\\def')).toEqual(path.win32);
    expect(__TEST__._pathModuleFor('C:\\abc\\def.txt')).toEqual(path.win32);
    expect(__TEST__._pathModuleFor('D:\\abc\\aaa bbb')).toEqual(path.win32);
    expect(__TEST__._pathModuleFor('\\abc\\def')).toEqual(path.win32);

    // Default to Posix
    expect(__TEST__._pathModuleFor('abcdef')).toEqual(path.posix);
  });

  it('properly converts file URIs to local paths', () => {
    expect(nuclideUri.uriToNuclideUri('\\abc\\def')).toEqual(null);
    expect(nuclideUri.uriToNuclideUri('file://somehost/file/path')).toEqual(
      '/file/path',
    );
    expect(nuclideUri.uriToNuclideUri('file://C:\\some\\file\\path')).toEqual(
      'C:\\some\\file\\path',
    );
  });

  it('properly handles backslash-containing remote URIs', () => {
    expect(nuclideUri.getPath('nuclide://host/aaa\\bbb.txt')).toBe(
      '/aaa\\bbb.txt',
    );
    expect(nuclideUri.getPath('nuclide://host/dir/aaa\\bbb.txt')).toBe(
      '/dir/aaa\\bbb.txt',
    );
    expect(nuclideUri.getPath('nuclide://host/one\\two\\file.txt')).toBe(
      '/one\\two\\file.txt',
    );
  });

  it('correctly distinguishes paths that refer to files in an archive', () => {
    expect(nuclideUri.isInArchive('abc')).toBe(false);
    expect(nuclideUri.isInArchive('/abc')).toBe(false);
    expect(nuclideUri.isInArchive('nuclide://host/abc')).toBe(false);
    expect(nuclideUri.isInArchive('abc.zip')).toBe(false);
    expect(nuclideUri.isInArchive('abc.jar')).toBe(false);
    expect(nuclideUri.isInArchive('abc.zip!def')).toBe(true);
    expect(nuclideUri.isInArchive('abc.jar!def')).toBe(true);
    expect(nuclideUri.isInArchive('/abc.zip!def')).toBe(true);
    expect(nuclideUri.isInArchive('/abc.jar!def')).toBe(true);
    expect(nuclideUri.isInArchive('C:\\abc.zip!def')).toBe(true);
    expect(nuclideUri.isInArchive('C:\\abc.jar!def')).toBe(true);
    expect(nuclideUri.isInArchive('nuclide://host/abc.zip!def')).toBe(true);
    expect(nuclideUri.isInArchive('nuclide://host/abc.jar!def')).toBe(true);
  });

  it('reports first ancestor outside archive', () => {
    expect(nuclideUri.ancestorOutsideArchive('abc')).toBe('abc');
    expect(nuclideUri.ancestorOutsideArchive('/abc')).toBe('/abc');
    expect(nuclideUri.ancestorOutsideArchive('nuclide://host/abc')).toBe(
      'nuclide://host/abc',
    );
    expect(nuclideUri.ancestorOutsideArchive('abc.zip')).toBe('abc.zip');
    expect(nuclideUri.ancestorOutsideArchive('abc.jar')).toBe('abc.jar');
    expect(nuclideUri.ancestorOutsideArchive('abc.zip!def')).toBe('abc.zip');
    expect(nuclideUri.ancestorOutsideArchive('abc.jar!def')).toBe('abc.jar');
    expect(nuclideUri.ancestorOutsideArchive('/abc.zip!def')).toBe('/abc.zip');
    expect(nuclideUri.ancestorOutsideArchive('/abc.jar!def')).toBe('/abc.jar');
    expect(nuclideUri.ancestorOutsideArchive('C:\\abc.zip!def')).toBe(
      'C:\\abc.zip',
    );
    expect(nuclideUri.ancestorOutsideArchive('C:\\abc.jar!def')).toBe(
      'C:\\abc.jar',
    );
    expect(
      nuclideUri.ancestorOutsideArchive('nuclide://host/abc.zip!def'),
    ).toBe('nuclide://host/abc.zip');
    expect(
      nuclideUri.ancestorOutsideArchive('nuclide://host/abc.jar!def'),
    ).toBe('nuclide://host/abc.jar');
  });
});
