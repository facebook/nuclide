/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.VirtualMachine;
import com.sun.jdi.connect.IllegalConnectorArgumentsException;
import com.sun.jdi.connect.VMStartException;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Implement Nuclide bootstrap domain protocols. TODO: document this domain protocls in
 * protocol.json.
 */
public class BootstrapDomain extends DomainHandlerBase {
  public BootstrapDomain(ContextManager contextManager) {
    super("LaunchHook", contextManager);
  }

  public static String getArgStringFromArgs(Object args) {
    StringBuilder sb = new StringBuilder();
    if (args != null) {
      JSONArray arr = (JSONArray) args;
      for (int i = 0; i < arr.length(); i++) {
        Object arg = arr.get(i);
        if (arg != null) {
          sb.append(" " + arg.toString());
        }
      }
    }

    return sb.toString().trim();
  }

  JSONObject handleMethod(String id, String methodName, JSONObject params)
      throws DomainHandlerException {
    JSONObject response = new JSONObject();
    String sourcePath;

    switch (methodName) {
      case "launch":
        sourcePath = params.has("sourcePath") ? String.valueOf(params.get("sourcePath")) : null;
        launch(
            String.valueOf(params.get("commandLine")),
            String.valueOf(params.get("classPath")),
            params.get("args"),
            sourcePath);
        break;

      case "attachPort":
        sourcePath = params.has("sourcePath") ? String.valueOf(params.get("sourcePath")) : null;
        attachPort((int) params.get("port"), sourcePath);
        break;

      case "listen":
        startListening((int) params.get("port"));
        break;

      case "setSourcePath":
        setSourcePath(String.valueOf(params.get("sourcePath")));
        break;

      case "stopDebugging":
        System.exit(0);

      default:
        throwUndefinedMethodException(methodName);
        break;
    }
    return response;
  }

  private void startListening(int port) throws DomainHandlerException {
    JVMConnector jvmConnector = new JVMConnector();
    final VirtualMachine virtualMachine;
    try {
      virtualMachine = jvmConnector.startListening(port);
    } catch (IOException | IllegalConnectorArgumentsException e) {
      String errorMessage = String.format("Listening failed for port '%s'", port);
      throw new DomainHandlerException(errorMessage, e);
    }
    getContextManager().setVirtualMachine(virtualMachine);
    startEventThread();
  }

  private void setSourcePath(String sourcePath) {
    Utils.logVerbose("Got new source file path from client: " + sourcePath);
    getContextManager().setSourcePath(sourcePath);
  }

  public void launch(String launchCommandLine, String classPath, Object args, String sourcePath)
      throws DomainHandlerException {
    // TODO: validate classPath/sourcePath?
    getContextManager().setClassPath(classPath);
    if (sourcePath != null) {
      getContextManager().setSourcePath(sourcePath);
    }

    try {
      launchDebugger(launchCommandLine, getArgStringFromArgs(args));
    } catch (VMStartException | IOException | IllegalConnectorArgumentsException e) {
      String errorMessage = String.format("Launch failed for '%s'", launchCommandLine);
      throw new DomainHandlerException(errorMessage, e);
    }
    startEventThread();
  }

  private void startEventThread() {
    ContextManager cm = getContextManager();
    VirtualMachine vm = cm.getVirtualMachine();

    // first start event thread
    EventThread eventThread = new EventThread(cm, vm.eventQueue(), cm.getAppExitEvent());
    cm.setEventThread(eventThread);
    eventThread.start();

    // send appropriate thread events
    vm.allThreads().forEach(cm::handleThreadStart);
  }

  private void launchDebugger(String commandLine, String args)
      throws VMStartException, IOException, IllegalConnectorArgumentsException {
    try {
      JVMConnector jvmConnector = new JVMConnector();
      jvmConnector.launch(getContextManager(), commandLine, args);
    } catch (Exception e) {
      Utils.sendUserMessage(
          getContextManager(),
          "Error launching Java process: " + e.toString(),
          Utils.UserMessageLevel.ERROR,
          true);
      throw e;
    }
  }

  public void attachPort(int port, String sourcePath) throws DomainHandlerException {
    if (sourcePath != null) {
      getContextManager().setSourcePath(sourcePath);
    }

    try {
      attachDebugger(port);
    } catch (IOException | IllegalConnectorArgumentsException e) {
      // Wait a moment before exiting to give the user message a chance to flush.
      try {
        Thread.sleep(3000);
      } catch (Exception ex) {
      }

      System.exit(-1);
    }

    startEventThread();
    // Attach mode does not emit loader breakpoint so we fake one here.
    sendFakeLoaderBreakpoint();
  }

  /** Fake loader breakpoint is a Debugger.paused notification with empty callstack. */
  private void sendFakeLoaderBreakpoint() {
    getContextManager().pauseVm(DebuggerStopReason.LOADER_BREAK, false /* needsResponse */);

    NotificationChannel channel = getContextManager().getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      // do nothing, already handled in the above getContextManager().pauseVm
    } else {
      // UI never display loader breakpoint now so use empty callstack to improve performance.
      JSONArray emptyCallFrames = new JSONArray();
      JSONObject params = new JSONObject();
      params.put("reason", "Loader breakpoint");
      params.put("callFrames", emptyCallFrames);

      JSONObject notificationJson = new JSONObject();
      notificationJson.put("method", "Debugger.paused");
      notificationJson.put("params", params);
      Utils.sendClientNotification(getContextManager(), notificationJson);
    }
  }

  private void attachDebugger(int port) throws IOException, IllegalConnectorArgumentsException {
    try {
      JVMConnector jvmConnector = new JVMConnector();
      final VirtualMachine virtualMachine = jvmConnector.attachPort("localhost", port);
      getContextManager().setVirtualMachine(virtualMachine);
    } catch (Exception ex) {
      Utils.logError("Error attaching to Java process on port(" + port + ")");
      // Log the stack trace in the bug report but don't display to the user
      Utils.logVerboseException("", ex);
      // Display just the suggested workaround to the user, in the future this should be replaced
      //   with a link to a dex that helps the user debug various connection issues
      String ADB_CONNECTION_WORKAROUND_MESSAGE =
          "If you are debugging an Android application, please try the following steps:\n"
              + "    1. Close IntelliJ or Android Studio if they are running.\n"
              + "    2. Run `pkill adb` from a terminal.\n"
              + "    3. Restart Nuclide and try attaching again.";
      Utils.logWarning(ADB_CONNECTION_WORKAROUND_MESSAGE);
      Utils.logError("Otherwise, please file a bug using the bugnub (bottom left in Nuclide).");
      // let exception continue on upwards to get debugger to exit
      throw ex;
    }
  }
}
