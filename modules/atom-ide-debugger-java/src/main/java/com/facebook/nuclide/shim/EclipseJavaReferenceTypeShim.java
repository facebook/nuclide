/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.ContextManager;
import com.facebook.nuclide.debugger.Utils;
import com.sun.jdi.ArrayType;
import com.sun.jdi.ClassType;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import java.util.List;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.ILaunch;
import org.eclipse.debug.core.model.IDebugTarget;
import org.eclipse.jdt.debug.core.IJavaArray;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaValue;

interface IReferenceTypeProxy {
  public ReferenceType getReferenceType();
}

public class EclipseJavaReferenceTypeShim extends AbstractEclipseJavaReferenceTypeShim
    implements IReferenceTypeProxy {

  private final ReferenceType _type;
  private final ContextManager _contextManager;

  public EclipseJavaReferenceTypeShim(ReferenceType type, ContextManager contextManager) {
    _type = type;
    _contextManager = contextManager;
  }

  @Override
  public IDebugTarget getDebugTarget() {
    return new EclipseDebugTargetShim(_contextManager);
  }

  @Override
  public ILaunch getLaunch() {
    return new EclipseLaunchShim(_contextManager);
  }

  @Override
  public String getName() throws DebugException {
    return _type.name();
  }

  public ReferenceType getReferenceType() {
    return _type;
  }

  @Override
  public IJavaObject getClassLoaderObject() throws DebugException {
    return new EclipseJavaValueShim(_type.classLoader());
  }

  @Override
  public IJavaValue sendMessage(
      String selector, String signature, IJavaValue[] args, IJavaThread thread)
      throws DebugException {

    if (_type == null) {
      return null;
    }

    return EclipseJavaValueUtils.invokeMethodOnType(
        _type, selector, signature, args, thread, false, null);
  }

  @Override
  public IJavaObject newInstance(String signature, IJavaValue[] args, IJavaThread thread)
      throws DebugException {

    // Special handling for strings. In the case where we are doing new String("string"), this
    // actually behaves more like a primitive than a class object, even though it is a reference
    // type, because the JVM class provides a mirrorOf(string), which has already been invoked
    // to produce the argument value. We don't actually need to invoke the constructor here,
    // just wrap the Value correctly and pass it up to the interpreter.
    if (_type.name().equals("java.lang.String")
        && args.length == 1
        && args[0] instanceof IEclipseJavaValue) {

      ObjectReference ref = (ObjectReference) ((IEclipseValueWrapper) args[0]).getWrappedValue();
      return new EclipseJavaObjectValue(ref);
    }

    // Find the constructor for the type being instantiated.
    Method constructor = EclipseJavaValueUtils.findMethodOnType("<init>", signature, _type);
    if (constructor == null) {
      return null;
    }

    List<Value> arguments = EclipseJavaValueUtils.convertArguments(args);
    ClassType classType = (ClassType) _type;
    ThreadReference threadRef = ((EclipseJDIThreadShim) thread).getUnderlyingThread();
    try {
      ObjectReference result =
          classType.newInstance(
              threadRef, constructor, arguments, ClassType.INVOKE_SINGLE_THREADED);

      return new EclipseJavaValueShim(result);
    } catch (Exception e) {
      Utils.logException("Error while invoking constructor:", e);
      return null;
    }
  }

  @Override
  public IJavaArray newInstance(int size) {
    return new EclipseJavaValueShim(((ArrayType) _type).newInstance(size));
  }
}
