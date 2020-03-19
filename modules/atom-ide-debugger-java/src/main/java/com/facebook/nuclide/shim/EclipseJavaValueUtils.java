/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.Utils;
import com.sun.jdi.ClassObjectReference;
import com.sun.jdi.ClassType;
import com.sun.jdi.Field;
import com.sun.jdi.Method;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.Value;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.eclipse.debug.core.DebugException;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;
import org.eclipse.jdt.internal.debug.core.model.JDIThread;

public class EclipseJavaValueUtils {

  private EclipseJavaValueUtils() {}

  public static void enableCollection(Value value) {
    if (value instanceof ObjectReference) {
      ObjectReference ref = (ObjectReference) value;
      ref.enableCollection();
    }
  }

  public static void disableCollection(Value value) {
    if (value instanceof ObjectReference) {
      ObjectReference ref = (ObjectReference) value;
      ref.disableCollection();
    }
  }

  public static String getValueString(Value value) {
    if (value == null) {
      return "null";
    }

    return value.toString();
  }

  public static IJavaFieldVariable getField(Value value, String name, boolean superField) {
    if (!(value instanceof ObjectReference)) {
      // No fields on a primitive.
      return null;
    }

    ObjectReference obj = (ObjectReference) value;
    ReferenceType ref = (obj).referenceType();

    try {
      if (superField) {
        ref = ((ClassType) ref).superclass();
      }

      Field field = ref.fieldByName(name);
      if (field != null) {
        return new EclipseJavaObjectReferenceValueShim(obj, field, obj.getValue(field));
      }

      return ref.fields()
          .stream()
          .filter(f -> f.name().startsWith("this$"))
          .findFirst()
          .map(
              enclosingThis ->
                  new EclipseJavaObjectReferenceValueShim(
                      obj, enclosingThis, obj.getValue(enclosingThis)))
          .orElseGet(null);
    } catch (RuntimeException e) {
      return null;
    }
  }

  public static IJavaFieldVariable getField(Value value, String name, String typeSignature) {
    if (!(value instanceof ObjectReference)) {
      // No fields on a primitive.
      return null;
    }

    ObjectReference obj = (ObjectReference) value;
    ReferenceType ref = (obj).referenceType();
    try {
      return ref.allFields()
          .stream()
          .filter(
              field ->
                  name.equals(field.name())
                      && typeSignature.equals(field.declaringType().signature()))
          .findFirst()
          .map(field -> new EclipseJavaObjectReferenceValueShim(obj, field, obj.getValue(field)))
          .orElseGet(null);
    } catch (RuntimeException e) {
    }

    return null;
  }

  public static IJavaType getJavaType(Value value) {
    if ((value instanceof ObjectReference)) {
      ObjectReference obj = (ObjectReference) value;
      if (obj instanceof ClassObjectReference) {
        ReferenceType ref = ((ClassObjectReference) obj).reflectedType();
        return new EclipseJavaReferenceTypeShim(ref, null);
      } else {
        ReferenceType ref = obj.referenceType();
        return new EclipseJavaReferenceTypeShim(ref, null);
      }
    }

    return new EclipseJavaTypeShim(value);
  }

  public static List<Value> convertArguments(IJavaValue[] args) {
    return Arrays.asList(args)
        .stream()
        .map(val -> ((IEclipseValueWrapper) val).getWrappedValue())
        .collect(Collectors.toList());
  }

  public static Method findMethodOnType(String selector, String signature, ReferenceType type) {
    try {
      List<Method> methods = type.methodsByName(selector, signature);
      if (!methods.isEmpty()) {
        return methods.get(0);
      }
    } catch (RuntimeException e) {
      Utils.logException("Error while searching for method " + selector + " " + signature + ":", e);
    }

    return null;
  }

  public static IJavaValue invokeMethodOnType(
      ReferenceType type,
      String selector,
      String signature,
      IJavaValue[] args,
      IJavaThread thread,
      boolean superSend,
      Value value)
      throws DebugException {

    // TODO: respect superSend

    Method method = EclipseJavaValueUtils.findMethodOnType(selector, signature, type);
    if (method == null) {
      return null;
    }

    List<Value> arguments = EclipseJavaValueUtils.convertArguments(args);
    int options = 0;
    EclipseJDIThreadShim currentThread = (EclipseJDIThreadShim) thread;
    if (currentThread.getInvokeInProgress()) {
      throw new UnsupportedOperationException(
          "Cannot invoke a method  on thread while another evaluation is in progress");
    }

    try {
      Value result = null;
      ObjectReference ref;

      if (!method.isStatic() && value != null && value instanceof ObjectReference) {
        ObjectReference thisObj = (ObjectReference) value;
        ref = thisObj;
      } else {
        ClassObjectReference clazz = type.classObject();
        ref = clazz;
      }

      currentThread.setInvokeInProgress(true);
      result =
          ref.invokeMethod(((JDIThread) thread).getUnderlyingThread(), method, arguments, options);
      return new EclipseJavaValueShim(result);
    } catch (Exception e) {
      Utils.logException("Error invoking static method on class:", e);
      return null;
    } finally {
      currentThread.setInvokeInProgress(false);
    }
  }
}
