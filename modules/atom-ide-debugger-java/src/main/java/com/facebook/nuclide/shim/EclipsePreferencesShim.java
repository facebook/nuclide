/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.osgi.service.prefs.Preferences;

public class EclipsePreferencesShim extends AbstractEclipsePreferencesShim {
  public EclipsePreferencesShim() {}

  @Override
  public Preferences node(String string) {
    return new EclipseOsgiPreferencesShim();
  }
}
