/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.jdt.debug.core.IJavaType;

public abstract class AbstractEclipseJavaTypeShim extends AbstractEclipseShim<IJavaType>
    implements IJavaType {

  @Override
  public String getSignature() throws DebugException {
    return getProxy().getSignature();
  }

  @Override
  public String getName() throws DebugException {
    return getProxy().getName();
  }

  @Override
  public String getModelIdentifier() {
    return getProxy().getModelIdentifier();
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return getProxy().getDebugTarget();
  }

  @Override
  public ILaunch getLaunch() {
    return getProxy().getLaunch();
  }

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }
}
