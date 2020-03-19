/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.Utils;
import com.sun.jdi.ClassNotLoadedException;
import com.sun.jdi.Field;
import com.sun.jdi.InvalidTypeException;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.Value;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IValue;

public class EclipseJavaObjectReferenceValueShim extends EclipseJavaValueShim {
  private final Field _field;
  private final ObjectReference _obj;

  // Implements an EclipseJavaValueShim whose value is a field member of an object reference.
  public EclipseJavaObjectReferenceValueShim(ObjectReference obj, Field field, Value value) {
    super(value);
    _obj = obj;
    _field = field;
  }

  @Override
  public void setValue(IValue ivalue) throws DebugException {
    if (!(ivalue instanceof IEclipseValueWrapper)) {
      Utils.logWarning("value is not IEclipseValueWrapper");
      return;
    }

    IEclipseValueWrapper wrapper = (IEclipseValueWrapper) ivalue;
    Value value = wrapper.getWrappedValue();
    try {
      _obj.setValue(_field, value);
      super.setValue(value);
    } catch (ClassNotLoadedException | InvalidTypeException e) {
      Utils.logException("Couldn't set value:", e);
    }
  }
}
