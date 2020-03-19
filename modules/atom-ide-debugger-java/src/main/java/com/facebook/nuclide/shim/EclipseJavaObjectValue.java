/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.sun.jdi.ObjectReference;
import com.sun.jdi.Value;
import org.eclipse.debug.core.DebugException;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaType;

public class EclipseJavaObjectValue extends AbstractEclipseJavaObjectValue
    implements IEclipseValueWrapper {
  private final Value _value;

  public EclipseJavaObjectValue(Value value) {
    _value = value;
  }

  public Value getWrappedValue() {
    return _value;
  }

  @Override
  public void enableCollection() throws DebugException {
    EclipseJavaValueUtils.enableCollection(_value);
  }

  @Override
  public void disableCollection() throws DebugException {
    EclipseJavaValueUtils.disableCollection(_value);
  }

  @Override
  public String getValueString() throws DebugException {
    return EclipseJavaValueUtils.getValueString(_value);
  }

  @Override
  public IJavaFieldVariable getField(String name, boolean superField) {
    return EclipseJavaValueUtils.getField(_value, name, superField);
  }

  @Override
  public IJavaType getInstanceType() {
    try {
      return getJavaType();
    } catch (DebugException e) {
      return null;
    }
  }

  @Override
  public IJavaFieldVariable getField(String name, String typeSignature) {
    return EclipseJavaValueUtils.getField(_value, name, typeSignature);
  }

  @Override
  public IJavaType getJavaType() throws DebugException {
    return EclipseJavaValueUtils.getJavaType(_value);
  }

  @Override
  public long getUniqueId() throws DebugException {
    return ((ObjectReference) _value).uniqueID();
  }

  @Override
  public boolean isNull() {
    return _value == null;
  }
}
