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

import invariant from 'assert';
import {Observable} from 'rxjs';
import {getLogger} from 'log4js';
import * as BuckService from '../lib/BuckService';
import {copyBuildFixture} from '../../nuclide-test-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import * as processJs from 'nuclide-commons/process';

// Disable buckd so it doesn't linger around after the test.
process.env.NO_BUCKD = '1';

beforeEach(() => {
  // This timeout covers the average case. Blocks that need more time specify it
  // themselves.
  jasmine.getEnv().defaultTimeoutInterval = 10000;
});

describe('BuckService (test-project-with-failing-targets)', () => {
  let buckRoot: string;

  beforeEach(() => {
    waitsForPromise(async () => {
      if (buckRoot == null) {
        buckRoot = await copyBuildFixture(
          'test-project-with-failing-targets',
          __dirname,
        );
      }
    });
  });

  describe('.build(targets)', () => {
    it('generates report even if there are failing targets', () => {
      // First expensive buck operation gets a large timeout.
      waitsForPromise({timeout: 30000}, async () => {
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
            '//:bad_rule': jasmine.any(String),
          },
        };
        expect(report).toEqual(expectedReport);
        // Sometimes this ends in "\nstderr: " - No idea why.
        expect(report.failures['//:bad_rule']).toMatch(
          /^\/\/:bad_rule failed with exit code 1:\ngenrule/,
        );

        const lastCommand = await BuckService.getLastCommandInfo(buckRoot);
        invariant(lastCommand);
        expect(lastCommand.command).toBe('build');
        expect(lastCommand.args.slice(0, 2)).toEqual([
          '//:good_rule',
          '//:bad_rule',
        ]);
      });
    });

    it('respects extra options', () => {
      // Should immediately timeout.
      jasmine.useRealClock();
      waitsForPromise(async () => {
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
    });

    it('respects extra arguments', () => {
      waitsForPromise(async () => {
        try {
          await BuckService.build(buckRoot, ['//:good_rule'], {
            extraArguments: ['--help'],
          });
        } catch (e) {
          // The help option, naturally, lists itself.
          expect(e.message).toContain('--help');
          return;
        }
        throw new Error('promise should have been rejected');
      });
    });
  });

  describe('.showOutput(aliasOrTarget)', () => {
    it('returns the output data for a genrule()', () => {
      waitsForPromise(async () => {
        const output = await BuckService.showOutput(buckRoot, 'good');
        expect(output.length).toBe(1);
        expect(output[0]['buck.outputPath']).toBe(
          'buck-out/gen/good_rule/good.txt',
        );
      });
    });
  });

  describe('.buildRuleTypeFor(aliasesOrTargets)', () => {
    it('returns the type of a build rule specified by alias', () => {
      waitsForPromise(async () => {
        const resolved = await BuckService.buildRuleTypeFor(buckRoot, 'good');
        expect(resolved.type).toBe('genrule');
        expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });
    });

    it('returns the type of a build rule by full path', () => {
      waitsForPromise(async () => {
        const resolved = await BuckService.buildRuleTypeFor(
          buckRoot,
          '//:good_rule',
        );
        expect(resolved.type).toBe('genrule');
        expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });
    });

    it('does some parsing on rule names', () => {
      // To speed up this test, mock out the actual Buck process calls.
      spyOn(processJs, 'runCommand').andReturn(
        Observable.of(
          JSON.stringify({
            '//:good_rule': {
              'buck.type': 'genrule',
            },
          }),
        ),
      );

      waitsForPromise(async () => {
        // Omitting the // is fine too.
        const resolved = await BuckService.buildRuleTypeFor(
          buckRoot,
          ':good_rule',
        );
        expect(resolved.type).toBe('genrule');
        expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });

      waitsForPromise(async () => {
        // Strip out flavors.
        const resolved = await BuckService.buildRuleTypeFor(
          buckRoot,
          '//:good_rule#',
        );
        expect(resolved.type).toBe('genrule');
        expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved.buildTarget.flavors[0]).toBe('');
      });

      waitsForPromise(async () => {
        // Strip out flavors.
        const resolved = await BuckService.buildRuleTypeFor(
          buckRoot,
          '//:good_rule#foo',
        );
        expect(resolved.type).toBe('genrule');
        expect(resolved.buildTarget.qualifiedName).toBe('//:good_rule');
        expect(resolved.buildTarget.flavors[0]).toBe('foo');
      });
    });

    it('works for multi-target rules', () => {
      waitsForPromise(async () => {
        const resolved = await BuckService.buildRuleTypeFor(buckRoot, '//:');
        expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
        expect(resolved.buildTarget.qualifiedName).toBe('//:');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });

      waitsForPromise(async () => {
        const resolved = await BuckService.buildRuleTypeFor(buckRoot, '//...');
        expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
        expect(resolved.buildTarget.qualifiedName).toBe('//...');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });
    });

    it('fails when passed an invalid target', () => {
      waitsForPromise({shouldReject: true}, async () => {
        await BuckService.buildRuleTypeFor(buckRoot, '//not:athing');
      });
    });

    it('returns the type of a build rule specified by two aliases', () => {
      waitsForPromise({timeout: 30000}, async () => {
        const resolved = await BuckService.buildRuleTypeFor(
          buckRoot,
          'good good2',
        );
        expect(resolved.type).toBe(BuckService.MULTIPLE_TARGET_RULE_TYPE);
        expect(resolved.buildTarget.qualifiedName).toBe('good good2');
        expect(resolved.buildTarget.flavors.length).toBe(0);
      });
    });
  });
});

describe('BuckService (buck-query-project)', () => {
  let buckRoot: string;

  beforeEach(() => {
    waitsForPromise(async () => {
      if (buckRoot == null) {
        buckRoot = await copyBuildFixture('buck-query-project', __dirname);
      }
    });
  });

  describe('getOwner()', () => {
    it('gets the owner', () => {
      // First expensive buck operation gets a large timeout.
      waitsForPromise({timeout: 15000}, async () => {
        let owners = await BuckService.getOwners(buckRoot, 'examples/one.java');
        expect(owners.sort()).toEqual([
          '//examples:one',
          '//examples:two-tests',
        ]);

        owners = await BuckService.getOwners(
          buckRoot,
          'examples/one.java',
          '.*_library',
        );
        expect(owners).toEqual(['//examples:one']);
      });
    });
  });

  describe('getBuildFile()', () => {
    it('gets the build file', () => {
      waitsForPromise(async () => {
        const file = await BuckService.getBuildFile(buckRoot, '//examples:one');
        expect(file).toBe(nuclideUri.join(buckRoot, 'examples', 'BUCK'));
      });
    });

    it('errors with non-existent rule', () => {
      waitsForPromise(async () => {
        const logger = getLogger('nuclide-buck-rpc');
        spyOn(logger, 'error');
        const file = await BuckService.getBuildFile(buckRoot, '//nonexistent:');
        expect(file).toBe(null);
        // eslint-disable-next-line no-console
        expect(logger.error.argsForCall[0]).toMatch(
          /No build file for target "\/\/nonexistent:"/,
        );
      });
    });
  });
});

describe('BuckService (buckconfig-project)', () => {
  let buckRoot: string;

  beforeEach(() => {
    waitsForPromise(async () => {
      if (buckRoot == null) {
        buckRoot = await copyBuildFixture('buckconfig-project', __dirname);
      }
    });
  });

  describe('getBuckConfig()', () => {
    it('returns the correct value if present', () => {
      // First expensive buck operation gets a large timeout.
      waitsForPromise({timeout: 15000}, async () => {
        const value = await BuckService.getBuckConfig(buckRoot, 'cache', 'dir');
        expect(value).toBe('buck-cache');
      });
    });

    it('returns null if property is not set', () => {
      waitsForPromise(async () => {
        const value = await BuckService.getBuckConfig(
          buckRoot,
          'cache',
          'http_timeout',
        );
        expect(value).toBe(null);
      });
    });

    it('returns null if section is not present', () => {
      waitsForPromise(async () => {
        const value = await BuckService.getBuckConfig(
          buckRoot,
          'android',
          'target',
        );
        expect(value).toBe(null);
      });
    });
  });
});
