/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import java.util.List;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IRegisterGroup;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.debug.core.model.IVariable;
import org.eclipse.jdt.debug.core.IJavaClassType;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaReferenceType;
import org.eclipse.jdt.debug.core.IJavaStackFrame;
import org.eclipse.jdt.debug.core.IJavaValue;
import org.eclipse.jdt.debug.core.IJavaVariable;

public class AbstractEclipseJavaStackFrameShim extends AbstractEclipseShim<IJavaStackFrame>
    implements IJavaStackFrame {

  @Override
  public void dropToFrame() throws DebugException {
    getProxy().dropToFrame();
  }

  @Override
  public boolean canDropToFrame() {
    return getProxy().canDropToFrame();
  }

  @Override
  public void stepWithFilters() throws DebugException {
    getProxy().stepWithFilters();
  }

  @Override
  public boolean canStepWithFilters() {
    return getProxy().canStepWithFilters();
  }

  @Override
  public boolean isSynthetic() throws DebugException {
    return getProxy().isSynthetic();
  }

  @Override
  public boolean isStatic() throws DebugException {
    return getProxy().isStatic();
  }

  @Override
  public boolean isFinal() throws DebugException {
    return getProxy().isFinal();
  }

  @Override
  public boolean isPackagePrivate() throws DebugException {
    return getProxy().isPackagePrivate();
  }

  @Override
  public boolean isProtected() throws DebugException {
    return getProxy().isProtected();
  }

  @Override
  public boolean isPrivate() throws DebugException {
    return getProxy().isPrivate();
  }

  @Override
  public boolean isPublic() throws DebugException {
    return getProxy().isPublic();
  }

  @Override
  public void terminate() throws DebugException {
    getProxy().terminate();
  }

  @Override
  public boolean isTerminated() {
    return getProxy().isTerminated();
  }

  @Override
  public boolean canTerminate() {
    return getProxy().canTerminate();
  }

  @Override
  public void suspend() throws DebugException {
    getProxy().suspend();
  }

  @Override
  public void resume() throws DebugException {
    getProxy().resume();
  }

  @Override
  public boolean isSuspended() {
    return getProxy().isSuspended();
  }

  @Override
  public boolean canSuspend() {
    return getProxy().canSuspend();
  }

  @Override
  public boolean canResume() {
    return getProxy().canResume();
  }

  @Override
  public void stepReturn() throws DebugException {
    getProxy().stepReturn();
  }

  @Override
  public void stepOver() throws DebugException {
    getProxy().stepOver();
  }

  @Override
  public void stepInto() throws DebugException {
    getProxy().stepInto();
  }

  @Override
  public boolean isStepping() {
    return getProxy().isStepping();
  }

  @Override
  public boolean canStepReturn() {
    return getProxy().canStepReturn();
  }

  @Override
  public boolean canStepOver() {
    return getProxy().canStepOver();
  }

  @Override
  public boolean canStepInto() {
    return getProxy().canStepInto();
  }

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
  public boolean hasRegisterGroups() throws DebugException {
    return getProxy().hasRegisterGroups();
  }

  @Override
  public IRegisterGroup[] getRegisterGroups() throws DebugException {
    return getProxy().getRegisterGroups();
  }

  @Override
  public String getName() throws DebugException {
    return getProxy().getName();
  }

  @Override
  public int getCharEnd() throws DebugException {
    return getProxy().getCharEnd();
  }

  @Override
  public int getCharStart() throws DebugException {
    return getProxy().getCharStart();
  }

  @Override
  public int getLineNumber() throws DebugException {
    return getProxy().getLineNumber();
  }

  @Override
  public boolean hasVariables() throws DebugException {
    return getProxy().hasVariables();
  }

  @Override
  public IVariable[] getVariables() throws DebugException {
    return getProxy().getVariables();
  }

  @Override
  public IThread getThread() {
    return getProxy().getThread();
  }

  @Override
  public void forceReturn(IJavaValue ijv) throws DebugException {
    getProxy().forceReturn(ijv);
  }

  @Override
  public boolean canForceReturn() {
    return getProxy().canForceReturn();
  }

  @Override
  public boolean isVarArgs() throws DebugException {
    return getProxy().isVarArgs();
  }

  @Override
  public boolean wereLocalsAvailable() {
    return getProxy().wereLocalsAvailable();
  }

  @Override
  public IJavaReferenceType getReferenceType() throws DebugException {
    return getProxy().getReferenceType();
  }

  @Override
  public IJavaClassType getDeclaringType() throws DebugException {
    return getProxy().getDeclaringType();
  }

  @Override
  public IJavaObject getThis() throws DebugException {
    return getProxy().getThis();
  }

  @Override
  public IJavaVariable[] getLocalVariables() throws DebugException {
    return getProxy().getLocalVariables();
  }

  @Override
  public String getSourcePath() throws DebugException {
    return getProxy().getSourcePath();
  }

  @Override
  public String getSourcePath(String string) throws DebugException {
    return getProxy().getSourcePath(string);
  }

  @Override
  public String getSourceName(String string) throws DebugException {
    return getProxy().getSourceName(string);
  }

  @Override
  public String getSourceName() throws DebugException {
    return getProxy().getSourceName();
  }

  @Override
  public int getLineNumber(String string) throws DebugException {
    return getProxy().getLineNumber(string);
  }

  @Override
  public IJavaVariable findVariable(String string) throws DebugException {
    return getProxy().findVariable(string);
  }

  @Override
  public String getMethodName() throws DebugException {
    return getProxy().getMethodName();
  }

  @Override
  public List<String> getArgumentTypeNames() throws DebugException {
    return getProxy().getArgumentTypeNames();
  }

  @Override
  public String getSignature() throws DebugException {
    return getProxy().getSignature();
  }

  @Override
  public String getReceivingTypeName() throws DebugException {
    return getProxy().getReceivingTypeName();
  }

  @Override
  public String getDeclaringTypeName() throws DebugException {
    return getProxy().getDeclaringTypeName();
  }

  @Override
  public boolean isObsolete() throws DebugException {
    return getProxy().isObsolete();
  }

  @Override
  public boolean isOutOfSynch() throws DebugException {
    return getProxy().isOutOfSynch();
  }

  @Override
  public boolean isSynchronized() throws DebugException {
    return getProxy().isSynchronized();
  }

  @Override
  public boolean isStaticInitializer() throws DebugException {
    return getProxy().isStaticInitializer();
  }

  @Override
  public boolean isNative() throws DebugException {
    return getProxy().isNative();
  }

  @Override
  public boolean isConstructor() throws DebugException {
    return getProxy().isConstructor();
  }

  @Override
  public boolean supportsDropToFrame() {
    return getProxy().supportsDropToFrame();
  }
}
