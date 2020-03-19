/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import org.eclipse.debug.core.model.IStackFrame;

public class EclipseSourceLocatorShim extends AbstractEclipseSourceLocatorShim {
  private final ContextManager _contextManager;

  public EclipseSourceLocatorShim(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  @Override
  public Object getSourceElement(IStackFrame isf) {
    return new EclipseJavaElementShim(isf, _contextManager);
  }

  @Override
  public Object getSourceElement(Object object) {
    return new EclipseJavaElementShim(object, _contextManager);
  }
}
