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
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaVariable;

public abstract class AbstractEclipseJavaVariableShim<T extends AbstractEclipseJavaVariableShim<T>>
    extends AbstractEclipseShim<T> implements IJavaVariable {

  @Override
  public String getSignature() throws DebugException {
    return getProxy().getSignature();
  }

  @Override
  public String getGenericSignature() throws DebugException {
    return getProxy().getGenericSignature();
  }

  @Override
  public IJavaType getJavaType() throws DebugException {
    return getProxy().getJavaType();
  }

  @Override
  public boolean isLocal() throws DebugException {
    return getProxy().isLocal();
  }

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

  @Override
  public boolean isPublic() throws DebugException {
    return getProxy().isPublic();
  }

  @Override
  public boolean isPrivate() throws DebugException {
    return getProxy().isPrivate();
  }

  @Override
  public boolean isProtected() throws DebugException {
    return getProxy().isProtected();
  }

  @Override
  public boolean isPackagePrivate() throws DebugException {
    return getProxy().isPackagePrivate();
  }

  @Override
  public boolean isFinal() throws DebugException {
    return getProxy().isFinal();
  }

  @Override
  public boolean isStatic() throws DebugException {
    return getProxy().isStatic();
  }

  @Override
  public boolean isSynthetic() throws DebugException {
    return getProxy().isSynthetic();
  }
}
