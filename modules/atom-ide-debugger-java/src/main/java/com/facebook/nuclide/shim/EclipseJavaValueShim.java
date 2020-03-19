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
import com.sun.jdi.ObjectReference;
import com.sun.jdi.PrimitiveValue;
import com.sun.jdi.ReferenceType;
import com.sun.jdi.Type;
import com.sun.jdi.Value;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.eclipse.debug.core.DebugException;
import org.eclipse.debug.core.model.IValue;
import org.eclipse.debug.core.model.IVariable;
import org.eclipse.jdt.debug.core.IJavaFieldVariable;
import org.eclipse.jdt.debug.core.IJavaObject;
import org.eclipse.jdt.debug.core.IJavaThread;
import org.eclipse.jdt.debug.core.IJavaType;
import org.eclipse.jdt.debug.core.IJavaValue;

public class EclipseJavaValueShim extends AbstractEclipseJavaValueShim
    implements IEclipseValueWrapper {
  private Value _value;
  private final Optional<Type> _wrappedType;

  // New value of unknown origin.
  public EclipseJavaValueShim(Value value) {
    _value = value;
    _wrappedType = Optional.ofNullable(value).map(Value::type);
  }

  public Value getWrappedValue() {
    return _value;
  }

  @Override
  public void enableCollection() throws DebugException {
    EclipseJavaValueUtils.enableCollection(_value);
  }

  @Override
  public void disableCollection() throws DebugException {
    EclipseJavaValueUtils.disableCollection(_value);
  }

  @Override
  public String getValueString() throws DebugException {
    return EclipseJavaValueUtils.getValueString(_value);
  }

  @Override
  public int getLength() throws DebugException {
    if (_value == null) {
      return 0;
    }

    ArrayReference array = (ArrayReference) _value;
    return array.length();
  }

  @Override
  public IJavaValue[] getValues() throws DebugException {
    if (_value == null) {
      return new IJavaValue[0];
    }

    ArrayReference array = (ArrayReference) _value;
    IJavaValue[] values = new IJavaValue[array.length()];
    List<Value> arrayValues = array.getValues();

    for (int i = 0; i < array.length(); i++) {
      values[i] = new EclipseJavaArrayReferenceValueShim(array, i, arrayValues.get(i));
    }

    return values;
  }

  @Override
  public IJavaValue getValue(int i) throws DebugException {
    ArrayReference array = (ArrayReference) _value;
    return new EclipseJavaArrayReferenceValueShim(array, i, array.getValue(i));
  }

  @Override
  public IValue getValue() throws DebugException {
    return (IValue) this;
  }

  @Override
  public boolean getBooleanValue() {
    return ((PrimitiveValue) _value).booleanValue();
  }

  @Override
  public byte getByteValue() {
    return ((PrimitiveValue) _value).byteValue();
  }

  @Override
  public char getCharValue() {
    return ((PrimitiveValue) _value).charValue();
  }

  @Override
  public double getDoubleValue() {
    return ((PrimitiveValue) _value).doubleValue();
  }

  @Override
  public float getFloatValue() {
    return ((PrimitiveValue) _value).floatValue();
  }

  @Override
  public int getIntValue() {
    return ((PrimitiveValue) _value).intValue();
  }

  @Override
  public long getLongValue() {
    return ((PrimitiveValue) _value).longValue();
  }

  @Override
  public short getShortValue() {
    return ((PrimitiveValue) _value).shortValue();
  }

  @Override
  public IJavaFieldVariable getField(String name, boolean superField) {
    return EclipseJavaValueUtils.getField(_value, name, superField);
  }

  @Override
  public IJavaType getInstanceType() {
    try {
      return getJavaType();
    } catch (DebugException e) {
      return null;
    }
  }

  @Override
  public IJavaFieldVariable getField(String name, String typeSignature) {
    return EclipseJavaValueUtils.getField(_value, name, typeSignature);
  }

  @Override
  public IJavaObject[] getReferringObjects(long l) throws DebugException {
    IJavaObject[] objects = new IJavaObject[0];
    ArrayList<IJavaObject> list = new ArrayList<IJavaObject>();
    List<ObjectReference> refs = ((ObjectReference) _value).referringObjects(l);
    for (ObjectReference ref : refs) {
      list.add(new EclipseJavaValueShim(ref));
    }
    return list.toArray(objects);
  }

  @Override
  public IJavaType getJavaType() throws DebugException {
    return EclipseJavaValueUtils.getJavaType(_value);
  }

  @Override
  public long getUniqueId() throws DebugException {
    return ((ObjectReference) _value).uniqueID();
  }

  @Override
  public IVariable[] getVariables() throws DebugException {
    if (_value instanceof ArrayReference) {
      ArrayReference ref = (ArrayReference) _value;
      IJavaValue[] arrayValues = getValues();
      return Arrays.stream(arrayValues)
          .map(val -> new EclipseJavaVariableShim((EclipseJavaArrayReferenceValueShim) val))
          .collect(Collectors.toList())
          .toArray(new IVariable[arrayValues.length]);
    } else if (_value instanceof ObjectReference) {
      ObjectReference obj = (ObjectReference) _value;
      ReferenceType ref = (obj).referenceType();
      try {
        return ref.allFields()
            .stream()
            .map(
                field ->
                    new EclipseJavaVariableShim(
                        new EclipseJavaObjectReferenceValueShim(obj, field, obj.getValue(field))))
            .filter(val -> val != null)
            .collect(Collectors.toList())
            .toArray(new IVariable[0]);
      } catch (RuntimeException e) {
      }
    }

    return new IVariable[0];
  }

  @Override
  public IVariable getVariable(int i) throws DebugException {
    return getVariables()[i];
  }

  @Override
  public IVariable[] getVariables(int i, int i1) throws DebugException {
    return Arrays.copyOfRange(getVariables(), i, i1);
  }

  @Override
  public void setValue(IValue ivalue) throws DebugException {
    // TODO: If this is called, we tried to set the value of a value for which we don't
    // have an origin tracked. How we overwrite a value depends on if it's a local, argument
    // field of an object, or index in an array.
    Utils.logError("Cannot set value on java value from unknown origin");
  }

  protected void setValue(Value value) {
    _value = value;
  }

  @Override
  public boolean isNull() {
    return _value == null;
  }

  @Override
  public IJavaValue sendMessage(
      String selector, String signature, IJavaValue[] args, IJavaThread thread, boolean superSend)
      throws DebugException {
    if (!_wrappedType.isPresent()) {
      return null;
    }

    Type t = _wrappedType.get();
    if (!(t instanceof ReferenceType)) {
      return null;
    }

    ReferenceType type = (ReferenceType) t;
    return EclipseJavaValueUtils.invokeMethodOnType(
        type, selector, signature, args, thread, superSend, _value);
  }

  @Override
  public IJavaValue sendMessage(
      String selector,
      String signature,
      IJavaValue[] args,
      IJavaThread thread,
      String typeSignature)
      throws DebugException {
    // TODO: respect typeSignature.
    if (!_wrappedType.isPresent()) {
      return null;
    }

    Type t = _wrappedType.get();
    if (!(t instanceof ReferenceType)) {
      return null;
    }

    ReferenceType type = (ReferenceType) t;
    return EclipseJavaValueUtils.invokeMethodOnType(
        type, selector, signature, args, thread, false, _value);
  }

  @Override
  public boolean equals(Object obj) {
    if (!(obj instanceof EclipseJavaValueShim)) {
      return false;
    }

    EclipseJavaValueShim other = (EclipseJavaValueShim) obj;
    if (_value == null) {
      return other.getWrappedValue() == null;
    }
    return _value.equals(other.getWrappedValue());
  }
}
