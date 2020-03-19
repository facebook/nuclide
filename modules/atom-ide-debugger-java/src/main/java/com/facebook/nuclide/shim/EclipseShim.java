/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.Utils;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import javassist.CannotCompileException;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtMethod;
import javassist.NotFoundException;

/**
 * Provides a mechanism for doing hot-code surgery on some of the Eclipse dependencies we are using
 * to work around various assumptions the Eclipse debugger makes about the environment it's running
 * in. Unfortunately, it makes various assumptions about being inside the Eclipse UI plugin
 * framework, with an Eclipse project open, and various preferences available. We want to use a few
 * portions of the framework without actually pulling in all the rest, so this provides a mechanism
 * to replace the missing pieces with dynamic proxy objects.
 */
public class EclipseShim {
  private static final Set<String> _modifiedRoutines = new HashSet<String>();

  private EclipseShim() {}

  // Returns code to replace an entire method with a body that just returns void.
  public static String getEmptyMethodBody() {
    return getEmptyMethodBody("");
  }

  // Returns code to replace an entire method body with a body that returns the specified
  // token, which must be valid Java code to insert at the target location.
  public static String getEmptyMethodBody(String returnToken) {
    return "{ return " + returnToken + "; }";
  }

  // Replaces the specified method in the specified class with the specified replacement Java
  // source.
  public static void hotReplaceMethod(String className, String methodName, String replacementCode) {
    String key = className + "!" + methodName;
    if (_modifiedRoutines.contains(key)) {
      // Sanity check: we're not keeping track of the old method body, multiple changes to
      // the same method is likely a bug.
      Utils.logError("Method " + key + " was already replaced!");
      return;
    }

    try {
      ClassPool pool = ClassPool.getDefault();
      CtClass clazz = pool.get(className);
      CtMethod[] methods = clazz.getDeclaredMethods(methodName);
      Arrays.stream(methods)
          .forEach(
              method -> {
                try {
                  method.setBody(replacementCode);
                } catch (Exception e) {
                }
              });
      clazz.toClass();
      _modifiedRoutines.add(key);
    } catch (CannotCompileException | NotFoundException ex) {
      Utils.logException("Failed to detour " + key, ex);
    }
  }

  public static void addCatch(
      String className, String methodName, String exceptionType, String catchCode) {
    addCatch(className, methodName, null, exceptionType, catchCode);
  }

  public static void addCatch(
      String className,
      String methodName,
      CtClass[] params,
      String exceptionType,
      String catchCode) {
    try {
      ClassPool pool = ClassPool.getDefault();
      CtClass clazz = pool.get(className);
      CtClass exceptionClass = pool.get(exceptionType);
      if (params != null) {
        clazz.getDeclaredMethod(methodName, params).addCatch(catchCode, exceptionClass);
      } else {
        clazz.getDeclaredMethod(methodName).addCatch(catchCode, exceptionClass);
      }
      clazz.toClass();
    } catch (CannotCompileException | NotFoundException ex) {
      Utils.logException("Failed to add catch: ", ex);
    }
  }
}
