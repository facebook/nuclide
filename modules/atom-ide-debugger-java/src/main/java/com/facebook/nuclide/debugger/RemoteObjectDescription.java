/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.ArrayReference;
import com.sun.jdi.BooleanValue;
import com.sun.jdi.DoubleValue;
import com.sun.jdi.FloatValue;
import com.sun.jdi.IntegerValue;
import com.sun.jdi.LongValue;
import com.sun.jdi.ObjectReference;
import com.sun.jdi.ShortValue;
import com.sun.jdi.Value;
import com.sun.jdi.VoidValue;
import org.json.JSONObject;

// Maps a remote object to the properties needed by the Chrome protocol.
public class RemoteObjectDescription {
  public final String _chromeType;
  public final String _chromeSubType;
  public final String _value;
  public final String _description;
  public final String _objectId;

  private static final String CHROME_TYPE_OBJECT = "object";
  private static final String CHROME_TYPE_NUMBER = "number";
  private static final String CHROME_TYPE_BOOLEAN = "boolean";
  private static final String CHROME_TYPE_STRING = "string";

  private static final String CHROME_SUBTYPE_ARRAY = "array";
  private static final String CHROME_SUBTYPE_NULL = "null";

  private static final String VALUE_DESCRIPTION_NULL = "null";
  private static final String VALUE_DESCRIPTION_VOID = "(void)";

  private static final String INVALID_REMOTE_OBJECT_ID = null;

  public RemoteObjectDescription(RemoteObjectManager manager, Value value) {
    if (value == null) {

      // Indicate a NULL value to the frontend.
      _chromeType = CHROME_TYPE_OBJECT;
      _chromeSubType = CHROME_SUBTYPE_NULL;
      _value = VALUE_DESCRIPTION_NULL;
      _description = VALUE_DESCRIPTION_NULL;
      _objectId = INVALID_REMOTE_OBJECT_ID;

    } else if (value instanceof VoidValue) {

      // Chrome doesn't offer a "void" data type, so we'll use a string that indicates void.
      _chromeType = CHROME_TYPE_STRING;
      _chromeSubType = null;
      _value = VALUE_DESCRIPTION_VOID;
      _description = VALUE_DESCRIPTION_VOID;
      _objectId = INVALID_REMOTE_OBJECT_ID;

    } else if (value instanceof BooleanValue) {

      final String description = value.toString();
      _chromeType = CHROME_TYPE_BOOLEAN;
      _chromeSubType = null;
      _value = description;
      _description = description;
      _objectId = INVALID_REMOTE_OBJECT_ID;

    } else if (value instanceof ArrayReference) {

      // Arrays need to be given a remote object ID, which is sent to the client frontend.
      // The array reference itself is registered with the RemoteObjectManager, so that the frontend
      // can look up its details (including length, type, elements, etc).

      final String id = manager.registerRemoteObject(value);
      _chromeType = CHROME_TYPE_OBJECT;
      _chromeSubType = CHROME_SUBTYPE_ARRAY;
      _value = null;
      _description = value.toString();
      _objectId = id;

    } else if (value instanceof ObjectReference
        &&
        // Treat a remote object of type java.lang.String specially. We want it
        // returned to the frontend as a primitive String, rather than returning the
        // class object that implements the string.
        !((ObjectReference) value).type().name().equals("java.lang.String")) {

      // Objects need to be given a remote object ID, which is sent to the client frontend.
      // The object itself is registered with the RemoteObjectManager, so that the frontend
      // can look up its details (including fields, etc).

      final String id = manager.registerRemoteObject(value);
      _chromeType = CHROME_TYPE_OBJECT;
      _chromeSubType = null;
      _value = null;
      _description = value.type().toString();
      _objectId = id;

    } else if (value instanceof DoubleValue
        || value instanceof FloatValue
        || value instanceof IntegerValue
        || value instanceof LongValue
        || value instanceof ShortValue) {

      // Numerical type.
      final String description = value.toString();
      _chromeType = CHROME_TYPE_NUMBER;
      _chromeSubType = null;
      _value = description;
      _description = description;
      _objectId = INVALID_REMOTE_OBJECT_ID;

    } else {

      String description = value.toString();
      if (description.startsWith("\"") && description.endsWith("\"")) {
        // Artifact of strings getting sent to us from the frontend. Don't display
        // strings like ""hello world"", this is probably not correct.
        description = description.substring(1, description.length() - 1);
      }

      _chromeType = CHROME_TYPE_STRING;
      _chromeSubType = null;
      _value = description;
      _description = description;
      _objectId = INVALID_REMOTE_OBJECT_ID;
    }
  }

  public JSONObject getSerializedObject() {
    final JSONObject result = new JSONObject();
    result.put("type", _chromeType);
    result.put("description", _description);

    // Subtypes are only expected for arrays and null values.
    if (_chromeSubType != null) {
      result.put("subtype", _chromeSubType);
    }

    // Values are only expected for primitive types.
    if (_value != null) {
      result.put("value", _value);
    }

    // Object IDs are only expected for ObjectReference and ArrayReference values.
    if (_objectId != INVALID_REMOTE_OBJECT_ID) {
      result.put("objectId", _objectId);
    }

    return result;
  }
}
