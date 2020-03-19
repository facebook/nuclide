/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.ArrayReference;
import com.sun.jdi.InternalException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.Value;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;

/** Manages the lifetime of all the RemoteObject(s). */
public class RemoteObjectManager {
  private final ContextManager _contextManager;
  private final ConcurrentHashMap<String, RemoteObject> _idToObjectMap = new ConcurrentHashMap<>();
  public final HashMap<Integer, Integer> frameIdToStackFrameIndex = new HashMap<Integer, Integer>();
  public final HashMap<Integer, ThreadReference> frameIdToThread =
      new HashMap<Integer, ThreadReference>();
  public final HashMap<Integer, Integer> scopeIdToFrameId = new HashMap<Integer, Integer>();

  public RemoteObjectManager(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  public ContextManager getContextManager() {
    return _contextManager;
  }

  /** Register local variables of input StackFrame and return its containing RemoteObject. */
  public VariableListRemoteObject registerLocals(StackFrame stackFrame) {
    VariableListRemoteObject localsRemoteObject;

    try {
      ObjectReference thisObj = stackFrame.thisObject();
      List<LocalVariable> localVariables = stackFrame.visibleVariables();
      Map<LocalVariable, Value> variableValueMap = stackFrame.getValues(localVariables);
      localsRemoteObject = new VariableListRemoteObject(this, variableValueMap, "Locals", thisObj);
    } catch (AbsentInformationException | InternalException e) {
      // No locals, can happen for frame without source. Fallback with empty locals.
      localsRemoteObject =
          new VariableListRemoteObject(
              this, new ConcurrentHashMap<LocalVariable, Value>(), "Locals", null);
    }

    addObject(localsRemoteObject);
    return localsRemoteObject;
  }

  public String registerRemoteObject(Value value) {
    RemoteObject obj = null;

    if (value instanceof ArrayReference) {
      obj = new ArrayReferenceRemoteObject(this, (ArrayReference) value);
    } else if (value instanceof ObjectReference) {
      obj = new ObjectReferenceRemoteObject(this, (ObjectReference) value);
    }

    if (obj == null) {
      throw new IllegalArgumentException("Unexpected Value type");
    }

    addObject(obj);
    return obj.getId();
  }

  public RemoteObject getObject(String objectId) {
    return _idToObjectMap.get(objectId);
  }

  public RemoteObject getObject(int objectIdAsInt) {
    return getObject(RemoteObject.OBJECT_ID_PREFIX + objectIdAsInt);
  }

  void clearObjects() {
    _idToObjectMap.clear();
    frameIdToThread.clear();
    frameIdToStackFrameIndex.clear();
    scopeIdToFrameId.clear();
  }

  /** Serialize value into RemoteObject in json representation. */
  public JSONObject serializeValue(Value value) {
    JSONObject result;

    if (value instanceof ArrayReference) {
      ArrayReferenceRemoteObject arrayReferenceRemoteObject =
          new ArrayReferenceRemoteObject(this, (ArrayReference) value);
      addObject(arrayReferenceRemoteObject);
      result = arrayReferenceRemoteObject.getSerializedValue();
    } else if (value instanceof ObjectReference) {
      ObjectReferenceRemoteObject objectReferenceRemoteObject =
          new ObjectReferenceRemoteObject(this, (ObjectReference) value);
      addObject(objectReferenceRemoteObject);
      result = objectReferenceRemoteObject.getSerializedValue();
    } else {
      result = (new RemoteObjectDescription(this, value)).getSerializedObject();
    }

    return result;
  }

  private void addObject(RemoteObject object) {
    _idToObjectMap.put(object.getId(), object);
    // TODO: add object group concepet for cleanup.
  }
}
