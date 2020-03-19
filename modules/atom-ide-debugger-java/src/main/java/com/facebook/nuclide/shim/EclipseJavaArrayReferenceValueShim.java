/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.shim;

import com.facebook.nuclide.debugger.Utils;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.ClassNotLoadedException;
import com.sun.jdi.InvalidTypeException;
import com.sun.jdi.Value;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IValue;

public class EclipseJavaArrayReferenceValueShim extends EclipseJavaValueShim {
  private final int _index;
  private final ArrayReference _array;

  // Implements an EclipseJavaValueShim whose value is an element inside an array.
  public EclipseJavaArrayReferenceValueShim(ArrayReference array, int index, Value value) {
    super(value);
    _index = index;
    _array = array;
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
      _array.setValue(_index, value);
      super.setValue(value);
    } catch (ClassNotLoadedException | InvalidTypeException e) {
      Utils.logException("Couldn't set value:", e);
    }
  }
}
