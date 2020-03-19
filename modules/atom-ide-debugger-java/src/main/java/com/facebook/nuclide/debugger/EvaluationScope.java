/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.Field;
import com.sun.jdi.InvalidStackFrameException;
import com.sun.jdi.Method;
import com.sun.jdi.NativeMethodException;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.StackFrame;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Implements an evaluation scope that determines which variables are visible at the current
 * expression evaluation site.
 */
public class EvaluationScope {
  private final StackFrame _stackFrame;
  private final ArrayList<String> _typeNames = new ArrayList<String>();
  private final ArrayList<String> _referencedTypeNames = new ArrayList<String>();
  private final ArrayList<String> _variableNames = new ArrayList<String>();
  private final Set<String> _variables = new HashSet<String>();
  private final String _expression;

  public EvaluationScope(StackFrame stackFrame, String expression) {
    _stackFrame = stackFrame;
    _expression = expression;

    // Add variable scopes in order of precidence in case of shadowing.
    // TODO: deal with shadowing.

    // Add local variables in the current call frame.
    addLocals();

    Method currentMethod = stackFrame.location().method();
    if (currentMethod != null) {
      if (!currentMethod.isStatic()) {
        // Add fields of the "this" object at the current call frame
        addFields();
      }
    }
  }

  // Adds all locals in the current stack frame.
  private void addLocals() {
    try {
      _stackFrame
          .visibleVariables()
          .parallelStream()
          .forEach(
              variable -> {
                String variableName = variable.name();
                addVariable(variableName, variable.typeName(), true);
              });

    } catch (InvalidStackFrameException | AbsentInformationException e) {
      // Can't get stack frame info. No variables.
    } catch (NativeMethodException e) {
      // TODO: we're in a JNI native frame...
    }
  }

  private void addFields() {
    ObjectReference thisObj = _stackFrame.thisObject();
    if (thisObj != null) {
      List<Field> fields = thisObj.referenceType().allFields();
      fields
          .parallelStream()
          .forEach(
              field -> {
                String fieldName = field.name();
                addVariable(fieldName, field.typeName(), false);
              });
    }
  }

  private void addVariable(String name, String type, boolean passToRunMethod) {
    if (name != null && !name.equals("")) {
      synchronized (this) {
        if (!_variables.contains(name)) {
          _variables.add(name);
          _typeNames.add(type);

          // Variables in the current scope that are not members of "this" and that
          // are potentially referenced by the expression should be passed as args
          // to the generated evaluation source's run() method.
          //
          // Other variables should be included in _typeNames so that we try to pull
          // in their sources for type resolution when generating the AST, but don't
          // get passed to the run() method.
          if (passToRunMethod && _expression.contains(name)) {
            _variableNames.add(name);
            _referencedTypeNames.add(type);
          }
        }
      }
    }
  }

  public String[] getReferencedTypeNames() {
    String[] typeArray = new String[0];
    return _referencedTypeNames.toArray(typeArray);
  }

  public String[] getVariableNames() {
    String[] typeArray = new String[0];
    return _variableNames.toArray(typeArray);
  }
}
