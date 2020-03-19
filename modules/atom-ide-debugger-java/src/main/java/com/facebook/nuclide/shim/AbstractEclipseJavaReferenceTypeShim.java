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
import org.eclipse.jdt.debug.core.IJavaArray;
import org.eclipse.jdt.debug.core.IJavaArrayType;
import org.eclipse.jdt.debug.core.IJavaClassObject;
import org.eclipse.jdt.debug.core.IJavaClassType;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaInterfaceType;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;

public abstract class AbstractEclipseJavaReferenceTypeShim
    extends AbstractEclipseShim<IJavaClassType> implements IJavaClassType, IJavaArrayType {

  @Override
  public <T> T getAdapter(Class<T> type) {
    return getProxy().getAdapter(type);
  }

  @Override
  public ILaunch getLaunch() {
    return getProxy().getLaunch();
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return getProxy().getDebugTarget();
  }

  @Override
  public String getModelIdentifier() {
    return getProxy().getModelIdentifier();
  }

  @Override
  public String getName() throws DebugException {
    return getProxy().getName();
  }

  @Override
  public String getSignature() throws DebugException {
    return getProxy().getSignature();
  }

  @Override
  public long getInstanceCount() throws DebugException {
    return getProxy().getInstanceCount();
  }

  @Override
  public IJavaObject[] getInstances(long l) throws DebugException {
    return getProxy().getInstances(l);
  }

  @Override
  public String[] getSourcePaths(String string) throws DebugException {
    return getProxy().getSourcePaths(string);
  }

  @Override
  public String[] getSourceNames(String string) throws DebugException {
    return getProxy().getSourceNames(string);
  }

  @Override
  public String getSourceName() throws DebugException {
    return getProxy().getSourceName();
  }

  @Override
  public String getGenericSignature() throws DebugException {
    return getProxy().getGenericSignature();
  }

  @Override
  public IJavaObject getClassLoaderObject() throws DebugException {
    return getProxy().getClassLoaderObject();
  }

  @Override
  public String[] getAllFieldNames() throws DebugException {
    return getProxy().getAllFieldNames();
  }

  @Override
  public String[] getDeclaredFieldNames() throws DebugException {
    return getProxy().getDeclaredFieldNames();
  }

  @Override
  public String getDefaultStratum() throws DebugException {
    return getProxy().getDefaultStratum();
  }

  @Override
  public String[] getAvailableStrata() throws DebugException {
    return getProxy().getAvailableStrata();
  }

  @Override
  public IJavaClassObject getClassObject() throws DebugException {
    return getProxy().getClassObject();
  }

  @Override
  public IJavaFieldVariable getField(String string) throws DebugException {
    return getProxy().getField(string);
  }

  @Override
  public IJavaInterfaceType[] getAllInterfaces() throws DebugException {
    return getProxy().getAllInterfaces();
  }

  @Override
  public IJavaInterfaceType[] getInterfaces() throws DebugException {
    return getProxy().getInterfaces();
  }

  @Override
  public IJavaClassType getSuperclass() throws DebugException {
    return getProxy().getSuperclass();
  }

  @Override
  public boolean isEnum() throws DebugException {
    return getProxy().isEnum();
  }

  @Override
  public IJavaObject newInstance(String signature, IJavaValue[] args, IJavaThread thread)
      throws DebugException {
    return getProxy().newInstance(signature, args, thread);
  }

  public IJavaType getComponentType() {
    return null;
  }

  public IJavaArray newInstance(int size) {
    return null;
  }
}
