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
import servicesConfig from '../lib/servicesConfig';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('servicesConfig()', () => {
  it('refers to files that exist', () => {
    servicesConfig.forEach(service => {
      expect(fs.existsSync(service.definition)).toBe(true);
      expect(fs.existsSync(service.implementation)).toBe(true);
    });
  });

  it('resolves absolute paths', () => {
    servicesConfig.forEach(service => {
      expect(nuclideUri.isAbsolute(service.definition)).toBe(true);
      expect(nuclideUri.isAbsolute(service.implementation)).toBe(true);
    });
  });

  it('loads the number of services expected', () => {
    const numberOfServices = servicesConfig.length;
    const numberOfPublicServices = require('../services-3.json').length;
    expect(numberOfServices >= numberOfPublicServices).toBe(true);
  });
});
