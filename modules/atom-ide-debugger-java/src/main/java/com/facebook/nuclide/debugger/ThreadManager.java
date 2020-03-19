/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.InvalidStackFrameException;
import com.sun.jdi.StackFrame;
import com.sun.jdi.ThreadReference;
import java.io.IOError;
import java.io.IOException;
import java.util.Optional;
import java.util.stream.Collectors;
import org.json.JSONArray;
import org.json.JSONObject;

/** Provides threads management. */
public class ThreadManager {
  private final ContextManager _contextManager;
  private final String NOT_AVAILABLE_TEXT = "<Not Available>";
  // JDI does not provide process id.
  private final int JAVA_PROCESS_ID = -1;

  public ThreadManager(ContextManager contextManager) {
    _contextManager = contextManager;
  }

  public void sendThreadsNotification(
      DebuggerStopReason stopReason, ThreadReference stopThread, ThreadReference currentThread) {

    try {
      JSONObject notificationJson =
          getThreadUpdateNotification(stopReason, stopThread, currentThread);
      sendClient(notificationJson);
    } catch (IOException e) {
      // It is unexpected that we cannot send the thread notification to the debugger client.
      // Rethrow a runtime exception.
      Utils.logException("Failed to send threads notification to client:", e);
      throw new Error(e);
    }
  }

  public void sendDebuggerPausedNotification() {
    sendDebuggerPausedNotification("Hitting breakpoint");
  }

  public void sendDebuggerPausedNotification(String reason) {
    JSONArray callFrames =
        Utils.getThreadStackJson(_contextManager, _contextManager.getCurrentThread());
    JSONObject params = new JSONObject();
    params.put("reason", reason);
    params.put("callFrames", callFrames);

    JSONObject notificationJson = new JSONObject();
    notificationJson.put("method", "Debugger.paused");
    notificationJson.put("params", params);

    try {
      sendClient(notificationJson);
    } catch (IOException e) {
      Utils.logException("Failed to send paused notification to client:", e);
      throw new IOError(e);
    }
  }

  private void sendClient(JSONObject notificationJson) throws IOException {
    Utils.sendClientNotification(_contextManager, notificationJson);
  }

  private JSONObject addThreadStopInfo(
      ThreadReference thread, long stopThreadId, DebuggerStopReason stopReason) {
    JSONObject threadJson = new JSONObject();
    long threadId = thread.uniqueID();
    String threadName = thread.name();
    boolean stackFrameValid = false;

    threadJson.put("id", threadId);
    threadJson.put("name", threadName);
    threadJson.put("description", threadName);

    try {
      try {
        if (thread.frameCount() > 0) {
          StackFrame leafFrame = thread.frame(0);
          threadJson.put("address", Utils.getFrameName(leafFrame));
          threadJson.put(
              "location", Utils.getFrameLocationJson(_contextManager.getFileManager(), leafFrame));
          stackFrameValid = true;
        }
      } catch (InvalidStackFrameException e) {
      }

      if (stackFrameValid == false) {
        threadJson.put("address", NOT_AVAILABLE_TEXT);
        threadJson.put("location", NOT_AVAILABLE_TEXT);
      }

      if (threadId == stopThreadId) {
        threadJson.put("stopReason", Utils.getStopReasonString(stopReason));
      } else {
        threadJson.put("stopReason", "");
      }
    } catch (Exception e) {
      threadJson.put("address", NOT_AVAILABLE_TEXT);
      threadJson.put("location", NOT_AVAILABLE_TEXT);
    }

    return threadJson;
  }

  private JSONObject getThreadUpdateNotification(
      DebuggerStopReason stopReason, ThreadReference stopThread, ThreadReference currentThread) {

    if (stopThread == null) {
      stopThread = currentThread;
    }

    long currentThreadId = currentThread.uniqueID();
    long stopThreadId = stopThread.uniqueID();
    JSONArray threadListJson =
        new JSONArray(
            _contextManager
                .getVirtualMachine()
                .allThreads()
                .parallelStream()
                .map(thread -> addThreadStopInfo(thread, stopThreadId, stopReason))
                .collect(Collectors.toList()));

    JSONObject paramsJson = new JSONObject();
    paramsJson.put("owningProcessId", JAVA_PROCESS_ID);
    paramsJson.put("stopThreadId", currentThreadId);
    paramsJson.put("threads", threadListJson);

    JSONObject notificationJson = new JSONObject();
    notificationJson.put("method", "Debugger.threadsUpdated");
    notificationJson.put("params", paramsJson);

    return notificationJson;
  }

  private Optional<ThreadReference> getThreadById(int threadId) {
    return _contextManager
        .getVirtualMachine()
        .allThreads()
        .stream()
        .filter(thread -> thread.uniqueID() == threadId)
        .findFirst();
  }

  public JSONArray getThreadStack(int threadId) {
    return getThreadById(threadId)
        .map(thread -> Utils.getThreadStackJson(_contextManager, thread))
        .orElse(new JSONArray());
  }
}
