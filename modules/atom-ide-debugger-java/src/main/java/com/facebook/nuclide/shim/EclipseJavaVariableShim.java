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
import com.sun.jdi.ClassNotLoadedException;
import com.sun.jdi.InvalidTypeException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.Location;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IValue;

public class EclipseJavaVariableShim extends AbstractEclipseJavaVariableShim {
  private enum VariableType {
    Unknown,
    Local,
    CallArgument,
    ObjectField
  };

  private final ContextManager _contextManager;
  private final LocalVariable _variable;
  private final Location _location;
  private final ThreadReference _thread;
  private final VariableType _type;
  private Value _value;
  private EclipseJavaObjectReferenceValueShim _objectValue;
  private EclipseJavaArrayReferenceValueShim _arrayValue;

  public EclipseJavaVariableShim(
      StackFrame frame, LocalVariable variable, Value value, ContextManager contextManager) {
    _contextManager = contextManager;
    _variable = variable;
    _value = value;
    _type = VariableType.Local;
    _objectValue = null;
    _arrayValue = null;

    if (frame != null) {
      _thread = frame.thread();
      _location = frame.location();
    } else {
      _thread = null;
      _location = null;
    }
  }

  public EclipseJavaVariableShim(EclipseJavaObjectReferenceValueShim objectValue) {
    this(null, null, null, null);
    _objectValue = objectValue;
  }

  public EclipseJavaVariableShim(EclipseJavaArrayReferenceValueShim arrayValue) {
    this(null, null, null, null);
    _arrayValue = arrayValue;
  }

  @Override
  public String getName() throws DebugException {
    if (_variable == null) {
      return "";
    }

    return _variable.name();
  }

  @Override
  public IValue getValue() throws DebugException {
    if (_arrayValue != null) {
      Value val = _arrayValue.getWrappedValue();
      return new EclipseJavaValueShim(val);
    } else if (_objectValue != null) {
      Value val = _objectValue.getWrappedValue();
      return new EclipseJavaValueShim(val);
    } else {
      return new EclipseJavaValueShim(_value);
    }
  }

  @Override
  public void setValue(IValue ivalue) throws DebugException {
    if (!(ivalue instanceof IEclipseValueWrapper)) {
      Utils.logWarning("value is not IEclipseValueWrapper");
      return;
    }

    if (_arrayValue != null) {
      _arrayValue.setValue(ivalue);
    } else if (_objectValue != null) {
      _objectValue.setValue(ivalue);
    } else {
      IEclipseValueWrapper wrapper = (IEclipseValueWrapper) ivalue;
      Value value = wrapper.getWrappedValue();
      StackFrame frame = EclipseJavaStackFrameShim.getRefreshedStackFrame(_thread, _location);
      try {
        // The way we overwrite a variable depends on what type of variable it is.
        switch (_type) {
          case Local:
            // Local variables are overwritten via the JDI stack frame.
            frame.setValue(_variable, value);
            break;
          default:
            // TODO
            Utils.logError("Failed to set value: unimplemented for " + _type.toString());
        }
      } catch (ClassNotLoadedException | InvalidTypeException e) {
        Utils.logException("Couldn't set value:", e);
      }

      // On success, remember the new value.
      _value = value;
    }
  }
}
