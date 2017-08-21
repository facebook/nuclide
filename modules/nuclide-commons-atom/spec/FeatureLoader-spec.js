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

import idx from 'idx';
import fs from 'fs';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

import FeatureLoader from '../FeatureLoader';

const FEATURE_PACKAGE_DIR = path.join(__dirname, 'fixtures', 'feature-package');
const featurePkg = JSON.parse(
  fs.readFileSync(path.join(FEATURE_PACKAGE_DIR, 'package.json')).toString(),
);
const featureName = featurePkg.name;

const ROOT_PACKAGE_DIR = path.join(__dirname, 'fixtures', 'root-package');
const rootPkg = JSON.parse(
  fs.readFileSync(path.join(ROOT_PACKAGE_DIR, 'package.json')).toString(),
);

describe('FeatureLoader', () => {
  let loader;
  beforeEach(() => {
    loader = new FeatureLoader({
      pkgName: rootPkg.name,
      features: [
        {
          dirname: FEATURE_PACKAGE_DIR,
          pkg: featurePkg,
        },
      ],
    });
    atom.packages.loadPackage(ROOT_PACKAGE_DIR);
  });

  describe('load', () => {
    beforeEach(() => {
      spyOn(atom.packages, 'loadPackage');
      atom.config.set(`${rootPkg.name}.use.${featurePkg.name}`, true);
      loader.load();
      atom.packages.emitter.emit('did-load-package', {name: rootPkg.name});
    });

    it('sets a description including provided and consumed services', () => {
      expect(
        idx(loader.getConfig(), _ => _.use.properties[featureName].description),
      ).toEqual(
        'Hyperclick UI<br/>**Provides:** _hyperclick.observeTextEditor_<br/>**Consumes:** _hyperclick_',
      );
    });

    it("merges the feature config into the passed config's feature properties", () => {
      expect(idx(loader.getConfig(), _ => _[featureName].properties)).toEqual(
        featurePkg.atomConfig,
      );
    });

    it('loads the feature package when the root package loads', () => {
      runs(() => {
        expect(atom.packages.loadPackage).toHaveBeenCalledWith(
          FEATURE_PACKAGE_DIR,
        );
      });
    });
  });

  describe('activate', () => {
    it('activates the feature package right away if enabled', () => {
      spyOn(atom.packages, 'activatePackage');

      loader.load();
      atom.config.set(`${rootPkg.name}.use.${featurePkg.name}`, true);
      atom.packages.emitter.emit('did-load-package', {name: rootPkg.name});
      loader.activate();

      runs(() => {
        expect(atom.packages.activatePackage).toHaveBeenCalledWith(
          FEATURE_PACKAGE_DIR,
        );
      });
    });
  });

  describe('activating, deactivating, then activating again', () => {
    it('actives, deactivates, then activates feature packages', () => {
      spyOn(atom.packages, 'activatePackage');
      spyOn(atom.packages, 'deactivatePackage');

      loader.load();
      atom.config.set(`${rootPkg.name}.use.${featurePkg.name}`, true);
      atom.packages.emitter.emit('did-load-package', {name: rootPkg.name});
      loader.activate();

      expect(atom.packages.activatePackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_DIR,
      );

      loader.deactivate();
      expect(atom.packages.deactivatePackage).toHaveBeenCalledWith(
        featurePkg.name,
        true,
      );

      loader.activate();
      expect(atom.packages.activatePackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_DIR,
      );
    });
  });
});
