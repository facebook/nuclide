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
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaReferenceType;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;

public abstract class AbstractEclipseJavaValueShim<T extends AbstractEclipseJavaValueShim<T>>
    extends AbstractEclipseShim<IEclipseJavaValue> implements IEclipseJavaValue {

  @Override
  public IJavaValue[] getValues() throws DebugException {
    return getProxy().getValues();
  }

  @Override
  public IJavaValue getValue(int i) throws DebugException {
    return getProxy().getValue(i);
  }

  @Override
  public int getLength() throws DebugException {
    return getProxy().getLength();
  }

  @Override
  public void setValue(int i, IJavaValue ijv) throws DebugException {
    getProxy().setValue(i, ijv);
  }

  @Override
  public void setValues(IJavaValue[] ijvs) throws DebugException {
    getProxy().setValues(ijvs);
  }

  @Override
  public void setValues(int i, int i1, IJavaValue[] ijvs, int i2) throws DebugException {
    getProxy().setValues(i, i1, ijvs, i2);
  }

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
  public IVariable getVariable(int i) throws DebugException {
    return getProxy().getVariable(i);
  }

  @Override
  public IVariable[] getVariables(int i, int i1) throws DebugException {
    return getProxy().getVariables(i, i1);
  }

  @Override
  public int getSize() throws DebugException {
    return getProxy().getSize();
  }

  @Override
  public int getInitialOffset() {
    return getProxy().getInitialOffset();
  }

  @Override
  public IJavaType getInstanceType() {
    return getProxy().getInstanceType();
  }

  @Override
  public boolean isTransient() throws DebugException {
    return getProxy().isTransient();
  }

  @Override
  public boolean isVolatile() throws DebugException {
    return getProxy().isVolatile();
  }

  @Override
  public IJavaType getDeclaringType() {
    return getProxy().getDeclaringType();
  }

  @Override
  public IJavaObject getReceiver() {
    return getProxy().getReceiver();
  }

  @Override
  public IJavaReferenceType getReceivingType() {
    return getProxy().getReceivingType();
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
  public boolean hasValueChanged() throws DebugException {
    return getProxy().hasValueChanged();
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

  @Override
  public boolean getBooleanValue() {
    return getProxy().getBooleanValue();
  }

  @Override
  public byte getByteValue() {
    return getProxy().getByteValue();
  }

  @Override
  public char getCharValue() {
    return getProxy().getCharValue();
  }

  @Override
  public double getDoubleValue() {
    return getProxy().getDoubleValue();
  }

  @Override
  public float getFloatValue() {
    return getProxy().getFloatValue();
  }

  @Override
  public int getIntValue() {
    return getProxy().getIntValue();
  }

  @Override
  public long getLongValue() {
    return getProxy().getLongValue();
  }

  @Override
  public short getShortValue() {
    return getProxy().getShortValue();
  }
}
