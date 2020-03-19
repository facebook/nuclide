/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import org.eclipse.debug.core.model.ISourceLocator;

public class EclipseLaunchShim extends AbstractEclipseLaunchShim {
  private final ContextManager _contextManager;

  public EclipseLaunchShim(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  @Override
  public ISourceLocator getSourceLocator() {
    return new EclipseSourceLocatorShim(_contextManager);
  }
}
