/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import fs from 'fs';
// eslint-disable-next-line nuclide-internal/prefer-nuclide-uri
import path from 'path';

import FeatureLoader from '../FeatureLoader';

const FEATURE_PACKAGE_PATH = path.join(
  __dirname,
  '../__mocks__/fixtures',
  'feature-package',
);

const ALWAYS_ENABLED = 'always';

const featurePkg = JSON.parse(
  fs.readFileSync(path.join(FEATURE_PACKAGE_PATH, 'package.json')).toString(),
);
const featureName = path.basename(FEATURE_PACKAGE_PATH);

const ROOT_PACKAGE_DIRNAME = 'root-package';
const ROOT_PACKAGE_PATH = path.join(
  __dirname,
  '../__mocks__/fixtures',
  ROOT_PACKAGE_DIRNAME,
);
const rootName = path.basename(ROOT_PACKAGE_PATH);

describe('FeatureLoader', () => {
  let loader;
  beforeEach(() => {
    loader = new FeatureLoader({
      path: ROOT_PACKAGE_PATH,
      pkgName: rootName,
      features: [
        {
          path: FEATURE_PACKAGE_PATH,
          pkg: featurePkg,
        },
      ],
    });
    atom.packages.loadPackage(ROOT_PACKAGE_PATH);
  });

  describe('load', () => {
    beforeEach(() => {
      jest.spyOn(atom.packages, 'loadPackage').mockImplementation(() => {});
      atom.config.set(`${rootName}.use.${featureName}`, ALWAYS_ENABLED);
      loader.load();
      atom.packages.emitter.emit('did-load-package', {
        name: ROOT_PACKAGE_DIRNAME,
      });
    });

    it('sets a description including provided and consumed services', () => {
      expect(
        loader.getConfig()?.use?.properties?.[featureName]?.description,
      ).toEqual(
        'Hyperclick UI<br/>**Provides:** _hyperclick.observeTextEditor_<br/>**Consumes:** _hyperclick_',
      );
    });

    it("merges the feature config into the passed config's feature properties", () => {
      expect(loader.getConfig()?.[featureName]?.properties).toEqual(
        featurePkg.atomConfig,
      );
    });

    it.skip('loads the feature package when the root package loads', () => {
      expect(atom.packages.loadPackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_PATH,
      );
    });
  });

  describe('activate', () => {
    it.skip('activates the feature package right away if enabled', () => {
      jest.spyOn(atom.packages, 'activatePackage').mockImplementation(() => {});

      loader.load();
      atom.config.set(`${rootName}.use.${featureName}`, ALWAYS_ENABLED);
      atom.packages.emitter.emit('did-load-package', {
        name: ROOT_PACKAGE_DIRNAME,
      });
      loader.activate();

      expect(atom.packages.activatePackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_PATH,
      );
    });
  });

  describe('activating, deactivating, then activating again', () => {
    it.skip('actives, deactivates, then activates feature packages', () => {
      jest.spyOn(atom.packages, 'activatePackage').mockImplementation(() => {});
      jest
        .spyOn(atom.packages, 'deactivatePackage')
        .mockImplementation(() => {});

      loader.load();
      atom.config.set(`${rootName}.use.${featureName}`, ALWAYS_ENABLED);
      atom.packages.emitter.emit('did-load-package', {
        name: ROOT_PACKAGE_DIRNAME,
      });
      loader.activate();

      expect(atom.packages.activatePackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_PATH,
      );

      loader.deactivate();
      expect(atom.packages.deactivatePackage).toHaveBeenCalledWith(
        featureName,
        true,
      );

      loader.activate();
      expect(atom.packages.activatePackage).toHaveBeenCalledWith(
        FEATURE_PACKAGE_PATH,
      );
    });
  });
});
