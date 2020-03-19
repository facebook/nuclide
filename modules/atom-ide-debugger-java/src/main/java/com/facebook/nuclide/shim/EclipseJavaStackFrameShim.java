/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import com.facebook.nuclide.debugger.SourceFileSpec;
import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.InvalidStackFrameException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.Location;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.debug.core.model.IThread;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaReferenceType;
import org.eclipse.jdt.debug.core.IJavaVariable;

public class EclipseJavaStackFrameShim extends AbstractEclipseJavaStackFrameShim {
  private final ContextManager _contextManager;
  private final ThreadReference _thread;
  private Location _location;
  private StackFrame _cachedStackFrame;

  public EclipseJavaStackFrameShim(StackFrame frame, ContextManager contextManager) {
    _contextManager = contextManager;
    _thread = frame.thread();
    _location = frame.location();
    _cachedStackFrame = frame;
  }

  private StackFrame getStackFrame() {
    try {
      // Probe the cached frame and reuse it if it's still valid. Sadly StackFrame
      // doesn't offer an isValid() or anything similar.
      ThreadReference threadRef = _cachedStackFrame.thread();
      return _cachedStackFrame;
    } catch (InvalidStackFrameException e) {
      // The stack frame is no longer valid. Go back to the ThreadReference and find
      // the new stack frame object that corresponds to this location.
      _cachedStackFrame = getRefreshedStackFrame(_thread, _location);
      _location = _cachedStackFrame.location();
      return _cachedStackFrame;
    }
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return new EclipseDebugTargetShim(_contextManager);
  }

  @Override
  public String getDeclaringTypeName() throws DebugException {
    return _location.declaringType().name();
  }

  @Override
  public int getLineNumber() throws DebugException {
    return _location.lineNumber();
  }

  @Override
  public IJavaVariable[] getLocalVariables() throws DebugException {
    try {
      StackFrame frame = getStackFrame();
      List<LocalVariable> localVariables = frame.visibleVariables();
      Map<LocalVariable, Value> variableValueMap = frame.getValues(localVariables);
      IJavaVariable[] javaVariables =
          variableValueMap
              .keySet()
              .stream()
              .map(
                  variable ->
                      new EclipseJavaVariableShim(
                          frame, variable, variableValueMap.get(variable), _contextManager))
              .toArray(IJavaVariable[]::new);
      return javaVariables;
    } catch (AbsentInformationException e) {
      return new IJavaVariable[0];
    }
  }

  @Override
  public IJavaObject getThis() throws DebugException {
    ObjectReference obj = getStackFrame().thisObject();
    return new EclipseJavaValueShim(obj);
  }

  public static StackFrame getRefreshedStackFrame(ThreadReference threadRef, Location loc) {
    // If an evaluation expression executed any function, including instantiating a new reference
    // type object, the thread would have been unsuspended briefly, causing the JDI model to
    // invalidate the stack frame. Subsequent accesses would throw a InvalidStackFrameException.
    //
    // This routine goes back to the ThreadRef's frames and grabs a refreshed stack frame object.
    try {
      List<StackFrame> newFrames =
          threadRef
              .frames()
              .parallelStream()
              .filter(frame -> loc.equals(frame.location()))
              .collect(Collectors.toList());

      if (newFrames.size() > 0) {
        return newFrames.get(0);
      }
    } catch (Exception e) {
    }

    return null;
  }

  @Override
  public IThread getThread() {
    StackFrame frame = getStackFrame();
    return new EclipseJDIThreadShim(frame.thread());
  }

  @Override
  public IJavaReferenceType getReferenceType() throws DebugException {
    ReferenceType refType = _location.method().declaringType();
    return new EclipseJavaReferenceTypeShim(refType, _contextManager);
  }

  @Override
  public String getSourcePath() throws DebugException {
    SourceFileSpec fileSpec = _contextManager.getFileManager().register(Optional.of(_location));

    return fileSpec.getScriptId();
  }

  @Override
  public boolean isStatic() throws DebugException {
    return _location.method().isStatic();
  }
}
