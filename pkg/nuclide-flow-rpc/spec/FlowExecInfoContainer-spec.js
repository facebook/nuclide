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

import {FlowExecInfoContainer} from '../lib/FlowExecInfoContainer';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('FlowExecInfoContainer', () => {
  const dummyFlowPath = nuclideUri.join(__dirname, 'fixtures/dummyFlow');
  const withFlowBinProjectPath = nuclideUri.join(
    __dirname,
    'fixtures/with-flow-bin',
  );
  const withoutFlowBinProjectPath = nuclideUri.join(
    __dirname,
    'fixtures/without-flow-bin',
  );

  let infoContainer: FlowExecInfoContainer = (null: any);

  beforeEach(() => {
    infoContainer = new FlowExecInfoContainer();
    infoContainer._pathToFlow = dummyFlowPath;

    // These tests are run in stock Node, and rely on that fact. The code under test checks for the
    // existence of `global.atom` and gets config values from Atom if it exists. Otherwise it falls
    // back on defaults (meant for use on the nuclide-server). These tests manipulate the stored
    // values directly to test the effect of different config values. So, we do not want config
    // values from Atom interfering.
    expect(global.atom).toBeUndefined();
  });

  // Test this directly so caching doesn't get in the way
  describe('_computeFlowExecInfo', () => {
    describe('with flow-bin disallowed (default)', () => {
      describe('in a directory without flow-bin', () => {
        it('should return the system Flow binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(
              withoutFlowBinProjectPath,
            );
            invariant(execInfo != null);
            expect(execInfo.pathToFlow).toBe(dummyFlowPath);
          });
        });
      });
      describe('in a directory with flow-bin', () => {
        it('should return the system Flow binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(
              withFlowBinProjectPath,
            );
            invariant(execInfo != null);
            expect(execInfo.pathToFlow).toBe(dummyFlowPath);
          });
        });
        it('should return null if Flow cannot be found', () => {
          waitsForPromise(async () => {
            // If somebody has this on their PATH I'm going to be upset
            infoContainer._pathToFlow = 'notAValidExecutable';
            const execInfo = await infoContainer._computeFlowExecInfo(
              withFlowBinProjectPath,
            );
            expect(execInfo).toBeNull();
          });
        });
      });
      describe('outside of a Flow root', () => {
        it('should return the system Flow binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(null);
            invariant(execInfo != null);
            expect(execInfo.pathToFlow).toBe(dummyFlowPath);
          });
        });
      });
    });

    describe('with flow-bin allowed', () => {
      beforeEach(() => {
        infoContainer._canUseFlowBin = true;
      });
      describe('in a directory without flow-bin', () => {
        it('should return the system Flow binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(
              withoutFlowBinProjectPath,
            );
            invariant(execInfo != null);
            expect(execInfo.pathToFlow).toBe(dummyFlowPath);
          });
        });
      });
      describe('in a directory with flow-bin', () => {
        it('should return the local flow-bin binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(
              withFlowBinProjectPath,
            );
            invariant(execInfo != null);
            const flowBinPath = nuclideUri.join(
              withFlowBinProjectPath,
              'node_modules/.bin/flow',
            );
            expect(execInfo.pathToFlow).toBe(flowBinPath);
          });
        });
      });
      describe('outside of a Flow root', () => {
        it('should return the system Flow binary', () => {
          waitsForPromise(async () => {
            const execInfo = await infoContainer._computeFlowExecInfo(null);
            invariant(execInfo != null);
            expect(execInfo.pathToFlow).toBe(dummyFlowPath);
          });
        });
      });
    });
  });
});
