/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import org.json.JSONObject;

public abstract class base$ProtocolMessage {
  public static int nextSeq = 1;
  private static final Object nextSeqLock = new Object();
  public int seq;
  private String type;

  public base$ProtocolMessage(String type) {
    synchronized (nextSeqLock) {
      this.seq = nextSeq++;
    }
    this.type = type;
  }

  public base$ProtocolMessage(JSONObject messageJSON) {
    this.seq = messageJSON.getInt("seq");
    this.type = messageJSON.getString("type");
  }

  public base$ProtocolMessage(int seq, String type) {
    synchronized (nextSeqLock) {
      this.seq = seq;
      nextSeq++;
    }
    this.type = type;
  }

  public JSONObject toJSON() {
    return new JSONObject().put("seq", seq).put("type", type);
  }
}
