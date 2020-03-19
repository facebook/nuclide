/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.core.runtime.preferences.IEclipsePreferences;

public class EclipsePreferencesServiceShim extends AbstractEclipsePreferencesServiceShim {

  public EclipsePreferencesServiceShim() {}

  @Override
  public IEclipsePreferences getRootNode() {
    return new EclipsePreferencesShim();
  }
}
