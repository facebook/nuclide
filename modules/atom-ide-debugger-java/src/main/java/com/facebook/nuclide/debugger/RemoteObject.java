/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

/**
 * Abstract base class for RemoteObject. RemoteObject represents non-primitive java object that is
 * referred by objectId by Nuclide debugger protocol.
 */
abstract class RemoteObject {
  private final String _id;
  private final int _idAsInt;
  private static int _objectIdSeed = 0;
  public static final String OBJECT_ID_PREFIX = "RemoteObject.";
  private final RemoteObjectManager _remoteObjectManager;

  RemoteObject(RemoteObjectManager remoteObjectManager) {
    _idAsInt = getNextObjectId();
    _id = OBJECT_ID_PREFIX + _idAsInt;
    _remoteObjectManager = remoteObjectManager;
  }

  public String getId() {
    return _id;
  }

  public int getIdAsInt() {
    return _idAsInt;
  }

  public RemoteObjectManager getRemoteObjectManager() {
    return _remoteObjectManager;
  }

  private int getNextObjectId() {
    ++_objectIdSeed;
    return _objectIdSeed;
  }

  /**
   * Get the serialized object in JSON format.
   *
   * @return The important fields of the returned JSONObject are: 1. type: always use 'object' 2.
   *     objectId: the string id used by debugger UI to unique identify this RemoteObject. 3.
   *     description(optional): the summary text describing this object.
   */
  abstract JSONObject getSerializedValue();

  /**
   * Get current RemoteObject's the child field property descriptors in JSON format.
   *
   * @return The serialized object in JSON format: {result: [PropertyDescriptor]} The essential
   *     fields of PropertyDescriptor are: 1. name: name of this child field. 2. value: the
   *     serialized value of this child field object in JSONObject. 3. writable(optional): whether
   *     this field value can be modified or not. 4. wasThrown(optional): whether there is any
   *     exception thrown during evaluation or not.
   */
  abstract JSONObject getProperties();
}
