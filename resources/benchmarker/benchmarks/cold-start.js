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

const TIMEOUT = 30 * 1000;

const REPETITIONS = 3;

import invariant from 'assert';
// eslint-disable-next-line rulesdir/prefer-nuclide-uri
import path from 'path';
import {timedAsync} from '../benchmarker-utils';

const isNotTheme = pkg => pkg.getType !== 'theme';

// eslint-disable-next-line rulesdir/no-commonjs
module.exports = {
  description:
    'times how long it takes to activate packages for Atom & Nuclide',
  columns: [
    'mode',
    'claimedWindowLoadTime',
    'realLoadTime',
    'realPromiseLoadTime',
    'realActivateTime',
    'realPromiseActivateTime',
    'loadedCount',
    'activeCount',
    'summedClaimedLoadTime',
    'maxClaimedLoadTime',
    'summedClaimedActivateTime',
    'maxClaimedActivateTime',
    'slowestClaimedLoad',
    'slowestClaimedActivate',
  ],
  timeout: TIMEOUT,
  iterations: 2,
  repetitions: REPETITIONS,
  run: async (iteration: number): Object => {
    const claimedWindowLoadTime = atom.getWindowLoadTime();

    atom.packages.deactivatePackages();
    atom.packages.unloadPackages();

    const mode = iteration === 0 ? 'atom' : 'nuclide';
    switch (mode) {
      case 'atom':
        atom.packages.packageDirPaths = [];
        break;
      case 'nuclide':
        const atomHome = process.env.ATOM_HOME;
        invariant(atomHome != null);
        atom.packages.packageDirPaths = [path.join(atomHome, 'packages')];
        break;
    }

    const {
      time: realLoadTime,
      promiseTime: realPromiseLoadTime,
    } = await timedAsync(
      // $FlowFixMe: Not sure for what versions of Atom this worked
      atom.packages.loadPackages(),
    );
    const loadedPackages = atom.packages.getLoadedPackages().filter(isNotTheme);
    const loadedCount = loadedPackages.length;

    const {
      time: realActivateTime,
      promiseTime: realPromiseActivateTime,
    } = await timedAsync(atom.packages.activate());
    const activePackages = atom.packages.getActivePackages().filter(isNotTheme);
    const activeCount = activePackages.length;

    let summedClaimedLoadTime = 0;
    let maxClaimedLoadTime = 0;
    let slowestClaimedLoad = '';
    loadedPackages.forEach(pkg => {
      summedClaimedLoadTime += pkg.loadTime;
      maxClaimedLoadTime = Math.max(maxClaimedLoadTime, pkg.loadTime);
      if (maxClaimedLoadTime === pkg.loadTime) {
        slowestClaimedLoad = pkg.name;
      }
    });
    let summedClaimedActivateTime = 0;
    let maxClaimedActivateTime = 0;
    let slowestClaimedActivate = '';
    activePackages.forEach(pkg => {
      summedClaimedActivateTime += pkg.activateTime;
      maxClaimedActivateTime = Math.max(
        maxClaimedActivateTime,
        pkg.activateTime,
      );
      if (maxClaimedActivateTime === pkg.activateTime) {
        slowestClaimedActivate = pkg.name;
      }
    });

    const result = {
      mode,
      claimedWindowLoadTime,
      realLoadTime,
      realPromiseLoadTime,
      realActivateTime,
      realPromiseActivateTime,
      loadedCount,
      activeCount,
      summedClaimedLoadTime,
      maxClaimedLoadTime,
      summedClaimedActivateTime,
      maxClaimedActivateTime,
      slowestClaimedLoad,
      slowestClaimedActivate,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
    return result;
  },
};
