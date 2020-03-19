/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import {Observable} from 'rxjs';
import * as BuckService from '../lib/BuckService';
import {copyBuildFixture} from '../../nuclide-test-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as processJs from 'nuclide-commons/process';
import path from 'path';

jest.setTimeout(50000);

// flowlint-next-line sketchy-null-string:off
if (!process.env.SANDCASTLE) {
  // Disable buckd so it doesn't linger around after the test.
  process.env.NO_BUCKD = '1';
} else {
  // Enable this on Sandcastle for faster tests.
  process.env.NO_BUCKD = '';
}

describe('BuckService (test-project-with-failing-targets)', () => {
  let buckRoot: string;

  beforeEach(async () => {
    jest.restoreAllMocks();
    if (buckRoot == null) {
      buckRoot = await copyBuildFixture(
        'test-project-with-failing-targets',
        path.resolve(__dirname, '../__mocks__/'),
      );
    }
  });

  describe('.build(targets)', () => {
    it('generates report even if there are failing targets', async () => {
      // First expensive buck operation gets a large timeout.
      const targets = ['//:good_rule', '//:bad_rule'];
      const report = await BuckService.build(buckRoot, targets);
      const expectedReport = {
        success: false,
        results: {
          '//:good_rule': {
            success: true,
            type: 'BUILT_LOCALLY',
            output: 'buck-out/gen/good_rule/good.txt',
          },
          '//:bad_rule': {
            success: false,
          },
        },
        failures: {
          '//:bad_rule': expect.any(String),
        },
      };
      expect(report).toEqual(expectedReport);
      expect(report.failures.hasOwnProperty('//:bad_rule')).toBe(true);
    });

    it('respects extra options', async () => {
      try {
        await BuckService.build(buckRoot, ['//:good_rule'], {
          commandOptions: {timeout: 1},
        });
      } catch (e) {
        expect(e.name).toBe('ProcessTimeoutError');
        return;
      }
      throw new Error('promise should have been rejected');
    });

    it('respects extra arguments', async () => {
      try {
        await BuckService.build(buckRoot, ['//:good_rule'], {
          extraArguments: ['--help'],
        });
      } catch (e) {
        return;
      }
      throw new Error('promise should have been rejected');
    });
  });

  describe('.showOutput(aliasOrTarget)', () => {
    it('returns the output data for a genrule()', async () => {
      const output = await BuckService.showOutput(buckRoot, 'good');
      expect(output.length).toBe(1);
      expect(output[0]['buck.outputPath']).toBe(
        'buck-out/gen/good_rule/good.txt',
      );
    });
  });

  describe('.buildRuleTypeFor(aliasesOrTargets)', () => {
    it('returns the type of a build rule specified by alias', async () => {
      const resolved = await BuckService.buildRuleTypeFor(buckRoot, 'good');
      invariant(resolved != null);
      expect(resolved.type).toBe('genrule');
      expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
      expect(resolved.buildTarget.flavors.length).toBe(0);
    });

    it('returns the type of a build rule by full path', async () => {
      const resolved = await BuckService.buildRuleTypeFor(
        buckRoot,
        '//:good_rule',
      );
      invariant(resolved != null);
      expect(resolved.type).toBe('genrule');
      expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
      expect(resolved.buildTarget.flavors.length).toBe(0);
    });

    it('does some parsing on rule names', async () => {
      // To speed up this test, mock out the actual Buck process calls.
      jest.spyOn(processJs, 'runCommand').mockReturnValue(
        Observable.of(
          JSON.stringify({
            '//:good_rule': {
              'buck.type': 'genrule',
            },
          }),
        ),
      );

      // Omitting the // is fine too.
      const resolved = await BuckService.buildRuleTypeFor(
        buckRoot,
        ':good_rule',
      );
      invariant(resolved != null);
      expect(resolved.type).toBe('genrule');
      expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
      expect(resolved.buildTarget.flavors.length).toBe(0);

      {
        // Strip out flavors.
        const resolved2 = await BuckService.buildRuleTypeFor(
          buckRoot,
          '//:good_rule#',
        );
        invariant(resolved2 != null);
        expect(resolved2.type).toBe('genrule');
        expect(resolved2.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved2.buildTarget.flavors[0]).toBe('');
      }

      {
        // Strip out flavors.
        const resolved3 = await BuckService.buildRuleTypeFor(
          buckRoot,
          '//:good_rule#foo',
        );
        invariant(resolved3 != null);
        expect(resolved3.type).toBe('genrule');
        expect(resolved3.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved3.buildTarget.flavors[0]).toBe('foo');
      }
    });

    it('works for multi-target rules', async () => {
      {
        const resolved = await BuckService.buildRuleTypeFor(buckRoot, '//:');
        invariant(resolved != null);
        expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
        expect(resolved.buildTarget.qualifiedName).toBe('//:');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      }

      {
        const resolved = await BuckService.buildRuleTypeFor(buckRoot, '//...');
        invariant(resolved != null);
        expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
        expect(resolved.buildTarget.qualifiedName).toBe('//...');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      }
    });

    it('fails when passed an invalid target', async () => {
      const resolved = await BuckService.buildRuleTypeFor(
        buckRoot,
        '//not:athing',
      );
      expect(resolved).toBeNull();
    });

    it('returns the type of a build rule specified by two aliases', async () => {
      const resolved = await BuckService.buildRuleTypeFor(
        buckRoot,
        'good good2',
      );
      invariant(resolved != null);
      expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
      expect(resolved.buildTarget.qualifiedName).toBe('good good2');
      expect(resolved.buildTarget.flavors.length).toBe(0);
    });
  });
});

describe('BuckService (buck-query-project)', () => {
  let buckRoot: string;

  beforeEach(async () => {
    if (buckRoot == null) {
      buckRoot = await copyBuildFixture(
        'buck-query-project',
        path.resolve(__dirname, '../__mocks__/'),
      );
    }
  });

  describe('getOwner()', () => {
    it('gets the owner', async () => {
      // First expensive buck operation gets a large timeout.
      let owners = await BuckService.getOwners(
        buckRoot,
        'examples/one.java',
        [],
      );
      expect(owners.sort()).toEqual(['//examples:one', '//examples:two-tests']);

      owners = await BuckService.getOwners(
        buckRoot,
        'examples/one.java',
        [],
        '.*_library',
      );
      expect(owners).toEqual(['//examples:one']);
    });
  });

  describe('getBuildFile()', () => {
    it('gets the build file', async () => {
      const file = await BuckService.getBuildFile(
        buckRoot,
        '//examples:one',
        [],
      );
      expect(file).toBe(nuclideUri.join(buckRoot, 'examples', 'BUCK'));
    });
  });
});

describe('BuckService (buckconfig-project)', () => {
  let buckRoot: string;

  beforeEach(async () => {
    if (buckRoot == null) {
      buckRoot = await copyBuildFixture(
        'buckconfig-project',
        path.resolve(__dirname, '../__mocks__/'),
      );
    }
  });

  describe('getBuckConfig()', () => {
    it('returns the correct value if present', async () => {
      // First expensive buck operation gets a large timeout.
      const value = await BuckService.getBuckConfig(buckRoot, 'cache', 'dir');
      expect(value).toBe('buck-cache');
    });

    it('returns null if property is not set', async () => {
      const value = await BuckService.getBuckConfig(
        buckRoot,
        'cache',
        'http_timeout',
      );
      expect(value).toBe(null);
    });

    it('returns null if section is not present', async () => {
      const value = await BuckService.getBuckConfig(
        buckRoot,
        'android',
        'target',
      );
      expect(value).toBe(null);
    });
  });
});
