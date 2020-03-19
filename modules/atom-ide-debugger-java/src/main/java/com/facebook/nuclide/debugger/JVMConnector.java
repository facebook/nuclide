/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.Bootstrap;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.VirtualMachineManager;
import com.sun.jdi.connect.AttachingConnector;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.IllegalConnectorArgumentsException;
import com.sun.jdi.connect.ListeningConnector;
import com.sun.jdi.connect.VMStartException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** JVM connector that provides launch/attach/listen functionality for debugger. */
public class JVMConnector {
  private boolean _readConnectMessage = false;
  private Object _syncObj = new Object();

  // Port to ask the child to listen on.
  public static final int TARGET_PORT = 8889;

  public static List<String> getProcessCommandList(
      ContextManager contextManager, String commandLine, String args) {
    ArrayList<String> processCommandList = new ArrayList<String>(7);
    String javaPath = Utils.getJavaPath();
    processCommandList.add(javaPath);
    processCommandList.add("-Xdebug");
    processCommandList.add(
        "-Xrunjdwp:transport=dt_socket,address=127.0.0.1:" + TARGET_PORT + ",server=y,suspend=y");
    processCommandList.add("-classpath");
    processCommandList.add(contextManager.getClassPath());
    processCommandList.add(commandLine);
    processCommandList.add(args);
    return processCommandList;
  }

  /** Launch a java class for debugging. */
  public void launch(ContextManager contextManager, String commandLine, String args)
      throws VMStartException, IllegalConnectorArgumentsException, IOException {
    List<String> processCommandList = getProcessCommandList(contextManager, commandLine, args);
    ProcessBuilder builder = new ProcessBuilder(processCommandList);
    Process p = builder.start();
    processInputStream(contextManager, p.getInputStream(), Utils.UserMessageLevel.TEXT, true);
    processInputStream(contextManager, p.getErrorStream(), Utils.UserMessageLevel.ERROR, false);

    // Wait for the thread processing the remote process's STDOUT to see the attach message
    // From the JVM and connect.
    synchronized (_syncObj) {
      while (!_readConnectMessage) {
        try {
          _syncObj.wait();
        } catch (InterruptedException e) {
        }
      }
    }

    // A process that we launched should be terminated when the debug server dies. Otherwise
    // an orphaned (and possibly headless) Java process continues to run after Nuclide thinks
    // it has ended debugging.
    //
    // Note: this behavior differs from the attach case. We never kill a process we did not start.
    Runtime.getRuntime()
        .addShutdownHook(
            new Thread() {
              public void run() {
                p.destroy();
              }
            });
  }

  private boolean checkForConnectMessage(ContextManager contextManager) {
    // If this thread is processing STDOUT and it has not yet processed the
    // JVM attach message, attach to the target VM now.
    boolean connectMessage = false;
    synchronized (_syncObj) {
      if (!_readConnectMessage) {
        _readConnectMessage = true;
        connectMessage = true;
        try {
          VirtualMachine vm = attachPort("127.0.0.1", TARGET_PORT);
          contextManager.setVirtualMachine(vm);
        } catch (Exception ex) {
          Utils.sendUserMessage(
              contextManager,
              "Error launching Java process: " + ex.toString(),
              Utils.UserMessageLevel.ERROR,
              true);
        }

        _syncObj.notify();
      }
    }

    return connectMessage;
  }

  private void processInputStream(
      ContextManager contextManager,
      InputStream stream,
      Utils.UserMessageLevel level,
      boolean bootstrapThread) {
    Thread streamProcessThread =
        new Thread(
            new Runnable() {
              @Override
              public void run() {
                try (BufferedReader buffer = new BufferedReader(new InputStreamReader(stream))) {
                  buffer
                      .lines()
                      .forEach(
                          line -> {
                            // The first line of output will be from the JVM indicating it's
                            //   waiting for the debugger to attach. Don't show this to the user,
                            //   it's just for us.
                            boolean connectMessage = false;
                            if (bootstrapThread) {
                              connectMessage = checkForConnectMessage(contextManager);
                            }

                            if (!connectMessage) {
                              contextManager.sendUserMessage(line, level);
                            }
                          });
                } catch (IOException e) {
                  Utils.logException("Error processing stream:", e);
                }
              }
            });
    streamProcessThread.setDaemon(true);
    streamProcessThread.start();
  }

  /**
   * Listening for JVM debugging connection on tcp/ip port. The call will be blocked until
   * connection is made.
   */
  public VirtualMachine startListening(int port)
      throws IOException, IllegalConnectorArgumentsException {
    VirtualMachine vm = this.startListeningInternal(port);
    registerEventHooks();
    return vm;
  }

  private VirtualMachine startListeningInternal(int port)
      throws IOException, IllegalConnectorArgumentsException {
    ListeningConnector listeningConnector = null;
    for (ListeningConnector connector : Bootstrap.virtualMachineManager().listeningConnectors()) {
      listeningConnector = connector;
    }
    Map<String, Connector.Argument> args = listeningConnector.defaultArguments();
    args.get("port").setValue(Integer.toString(port));
    String listeningAddress = listeningConnector.startListening(args);
    Utils.logInfo(String.format("Listening at address: %s", listeningAddress));
    return listeningConnector.accept(args);
  }

  /** Register interesting JVM event hooks. */
  private void registerEventHooks() {
    // TODO: register exception breakpoints, etc...
    return;
  }

  /** Attach to a tcp/ip port on host machine. */
  public VirtualMachine attachPort(String hostName, int port)
      throws IOException, IllegalConnectorArgumentsException {
    VirtualMachine vm = attachInternal(hostName, port);
    registerEventHooks();
    return vm;
  }

  private VirtualMachine attachInternal(String hostName, int port)
      throws IOException, IllegalConnectorArgumentsException {
    AttachingConnector attachingConnector = this.getAttachingConnector("dt_socket");
    Map<String, Connector.Argument> args = attachingConnector.defaultArguments();
    args.get("hostname").setValue(hostName);
    args.get("port").setValue(Integer.toString(port));
    return attachingConnector.attach(args);
  }

  private AttachingConnector getAttachingConnector(String transportName) {
    VirtualMachineManager vmManager = Bootstrap.virtualMachineManager();
    return vmManager
        .attachingConnectors()
        .parallelStream()
        .map(
            attachConnector -> {
              Utils.logVerbose(attachConnector.transport().name());
              return attachConnector;
            })
        .filter(attachConnector -> attachConnector.transport().name().equals(transportName))
        .findAny()
        .orElse(null);
  }
}
