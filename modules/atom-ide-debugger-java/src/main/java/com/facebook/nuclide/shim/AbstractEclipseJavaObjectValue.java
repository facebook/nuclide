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
import org.eclipse.debug.core.model.IVariable;
import org.eclipse.jdt.debug.core.IJavaClassObject;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;

public abstract class AbstractEclipseJavaObjectValue<T extends AbstractEclipseJavaObjectValue<T>>
    extends AbstractEclipseShim<IJavaClassObject> implements IJavaClassObject {

  @Override
  public IJavaValue sendMessage(
      String string, String string1, IJavaValue[] ijvs, IJavaThread ijt, boolean bln)
      throws DebugException {
    return getProxy().sendMessage(string, string1, ijvs, ijt, bln);
  }

  @Override
  public IJavaValue sendMessage(
      String string, String string1, IJavaValue[] ijvs, IJavaThread ijt, String string2)
      throws DebugException {
    return getProxy().sendMessage(string, string1, ijvs, ijt, string2);
  }

  @Override
  public IJavaFieldVariable getField(String string, boolean bln) throws DebugException {
    return getProxy().getField(string, bln);
  }

  @Override
  public IJavaFieldVariable getField(String string, String string1) throws DebugException {
    return getProxy().getField(string, string1);
  }

  @Override
  public IJavaThread[] getWaitingThreads() throws DebugException {
    return getProxy().getWaitingThreads();
  }

  @Override
  public IJavaThread getOwningThread() throws DebugException {
    return getProxy().getOwningThread();
  }

  @Override
  public IJavaObject[] getReferringObjects(long l) throws DebugException {
    return getProxy().getReferringObjects(l);
  }

  @Override
  public void enableCollection() throws DebugException {
    getProxy().enableCollection();
  }

  @Override
  public void disableCollection() throws DebugException {
    getProxy().disableCollection();
  }

  @Override
  public long getUniqueId() throws DebugException {
    return getProxy().getUniqueId();
  }

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
  public boolean isNull() {
    return getProxy().isNull();
  }

  @Override
  public String getReferenceTypeName() throws DebugException {
    return getProxy().getReferenceTypeName();
  }

  @Override
  public String getValueString() throws DebugException {
    return getProxy().getValueString();
  }

  @Override
  public boolean isAllocated() throws DebugException {
    return getProxy().isAllocated();
  }

  @Override
  public IVariable[] getVariables() throws DebugException {
    return getProxy().getVariables();
  }

  @Override
  public boolean hasVariables() throws DebugException {
    return getProxy().hasVariables();
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
  public IJavaType getInstanceType() {
    return getProxy().getInstanceType();
  }
}
