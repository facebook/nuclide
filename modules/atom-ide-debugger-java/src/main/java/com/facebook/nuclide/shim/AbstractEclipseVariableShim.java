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
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;

public abstract class AbstractEclipseVariableShim extends AbstractEclipseShim<IVariable>
    implements IVariable {

  @Override
  public IValue getValue() throws DebugException {
    return getProxy().getValue();
  }

  @Override
  public String getName() throws DebugException {
    return getProxy().getName();
  }

  @Override
  public String getReferenceTypeName() throws DebugException {
    return getProxy().getReferenceTypeName();
  }

  @Override
  public boolean hasValueChanged() throws DebugException {
    return getProxy().hasValueChanged();
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

  @Override
  public void setValue(String string) throws DebugException {
    getProxy().setValue(string);
  }

  @Override
  public void setValue(IValue ivalue) throws DebugException {
    getProxy().setValue(ivalue);
  }

  @Override
  public boolean supportsValueModification() {
    return getProxy().supportsValueModification();
  }

  @Override
  public boolean verifyValue(String string) throws DebugException {
    return getProxy().verifyValue(string);
  }

  @Override
  public boolean verifyValue(IValue ivalue) throws DebugException {
    return getProxy().verifyValue(ivalue);
  }
}
