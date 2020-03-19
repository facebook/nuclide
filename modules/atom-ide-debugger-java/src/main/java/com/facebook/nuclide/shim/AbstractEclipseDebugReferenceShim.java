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
import org.eclipse.jdt.debug.core.IJavaClassObject;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaObject;

public abstract class AbstractEclipseDebugReferenceShim
    extends AbstractEclipseShim<IEclipseDebugReference> implements IEclipseDebugReference {

  @Override
  public IJavaFieldVariable getField(String string) throws DebugException {
    return getProxy().getField(string);
  }

  @Override
  public IJavaClassObject getClassObject() throws DebugException {
    return getProxy().getClassObject();
  }

  @Override
  public String[] getAvailableStrata() throws DebugException {
    return getProxy().getAvailableStrata();
  }

  @Override
  public String getDefaultStratum() throws DebugException {
    return getProxy().getDefaultStratum();
  }

  @Override
  public String[] getDeclaredFieldNames() throws DebugException {
    return getProxy().getDeclaredFieldNames();
  }

  @Override
  public String[] getAllFieldNames() throws DebugException {
    return getProxy().getAllFieldNames();
  }

  @Override
  public IJavaObject getClassLoaderObject() throws DebugException {
    return getProxy().getClassLoaderObject();
  }

  @Override
  public String getGenericSignature() throws DebugException {
    return getProxy().getGenericSignature();
  }

  @Override
  public String getSourceName() throws DebugException {
    return getProxy().getSourceName();
  }

  @Override
  public String[] getSourceNames(String string) throws DebugException {
    return getProxy().getSourceNames(string);
  }

  @Override
  public String[] getSourcePaths(String string) throws DebugException {
    return getProxy().getSourcePaths(string);
  }

  @Override
  public IJavaObject[] getInstances(long l) throws DebugException {
    return getProxy().getInstances(l);
  }

  @Override
  public long getInstanceCount() throws DebugException {
    return getProxy().getInstanceCount();
  }

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
