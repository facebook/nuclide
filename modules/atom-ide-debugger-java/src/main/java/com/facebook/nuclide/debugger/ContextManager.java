/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.ThreadReference;
import com.sun.jdi.VirtualMachine;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.ThreadDeathEvent;
import com.sun.jdi.event.ThreadStartEvent;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Contains all the debugger contextual information for client retrieval. */
public class ContextManager {

  // Members only accessed by the web socket request thread.
  private final CommandInterpreterBase _interpreter;
  private VirtualMachine _virtualMachine;
  private final BreakpointManager _breakpointManager = new BreakpointManager(this);
  private final Map<String, DomainHandlerBase> _domainHandlerMap = new HashMap<>();
  private final BootstrapDomain _bootstrapDomain;
  private final DebuggerDomain _debuggerDomain;
  private final SourceLocator _sourceLocator = new SourceLocator(this);
  private final NotificationChannel _channel;
  private final FileManager _fileManager = new FileManager(this);
  private String _classPath = null;
  private final RemoteObjectManager _remoteObjectManager = new RemoteObjectManager(this);
  private final ThreadManager _threadManager = new ThreadManager(this);
  private final AppExitEvent _appExitEvent;
  private EventThread _eventThread;
  private final ExceptionManager _exceptionManager = new ExceptionManager(this);
  private final EvaluationManager _evaluationManager = new EvaluationManager(this);
  private boolean vmStarted = false;
  private boolean configurationDone = false;
  private final Object resumeAfterVMStartAndConfigurationDoneLock = new Object();

  // The following members are accessed by the EventThread in addition to the web socket
  // thread, so all accesses must be synchronized.
  private ThreadReference _currentThread;
  private ThreadReference _stopThread;
  private DebuggerStopReason _stopReason;
  private boolean _initialSuspend = true;

  public ContextManager(
      CommandInterpreterBase interpreter, NotificationChannel channel, AppExitEvent appExitEvent) {
    _interpreter = interpreter;
    _channel = channel;
    _appExitEvent = appExitEvent;
    _bootstrapDomain = new BootstrapDomain(this);
    _debuggerDomain = new DebuggerDomain(this);
    _domainHandlerMap.put("Bootstrap", _bootstrapDomain);
    _domainHandlerMap.put("Debugger", _debuggerDomain);
    _domainHandlerMap.put("Runtime", new RuntimeDomain(this));
    setStopReason(DebuggerStopReason.NONE);
    _stopThread = null;
  }

  public void receivedVMStartEvent() {
    synchronized (resumeAfterVMStartAndConfigurationDoneLock) {
      vmStarted = true;
      if (vmStarted && configurationDone) {
        resumeVm(true /* needsResponse */);
      }
    }
  }

  public void receivedConfigurationDoneRequest() {
    synchronized (resumeAfterVMStartAndConfigurationDoneLock) {
      configurationDone = true;
      if (vmStarted && configurationDone) {
        resumeVm(true /* needsResponse */);
      }
    }
  }

  public void setVirtualMachine(VirtualMachine virtualMachine) {
    _virtualMachine = virtualMachine;
    _evaluationManager.setupEclipseJavaDebugShims();
  }

  public VirtualMachine getVirtualMachine() {
    return _virtualMachine;
  }

  public synchronized ThreadReference getCurrentThread() {
    return _currentThread;
  }

  public synchronized void setCurrentThread(int threadId) {
    ThreadReference threadRef =
        _virtualMachine
            .allThreads()
            .parallelStream()
            .filter(thread -> thread.uniqueID() == threadId)
            .findAny()
            .orElseGet(
                () ->
                    _virtualMachine
                        .allThreads()
                        .parallelStream()
                        .findAny()
                        .orElseThrow(() -> new Error("VM has no threads!")));
    this.setCurrentThread(threadRef);

    // Send updated debugger state to the frontend.
    if (_threadManager != null) {
      _threadManager.sendDebuggerPausedNotification();
      _threadManager.sendThreadsNotification(_stopReason, _stopThread, _currentThread);
    }
  }

  public synchronized void setCurrentThread(ThreadReference currentThread) {
    _currentThread = currentThread;
  }

  public AppExitEvent getAppExitEvent() {
    return _appExitEvent;
  }

  public BootstrapDomain getBootstrapDomain() {
    return _bootstrapDomain;
  }

  public DebuggerDomain getDebuggerDomain() {
    return _debuggerDomain;
  }

  public DomainHandlerBase getDomain(String domain) {
    return _domainHandlerMap.get(domain);
  }

  public BreakpointManager getBreakpointManager() {
    return _breakpointManager;
  }

  public void handleClassPrepareEvent(ClassPrepareEvent event) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      getBreakpointManager().handleClassPrepareEvent(event, javaDebuggerServer);
    } else {
      getBreakpointManager().handleClassPrepareEvent(event, null);
    }
  }

  public SourceLocator getSourceLocator() {
    return _sourceLocator;
  }

  public RemoteObjectManager getRemoteObjectManager() {
    return _remoteObjectManager;
  }

  public ThreadManager getThreadManager() {
    return _threadManager;
  }

  public void setClassPath(String classPath) {
    _classPath = classPath;
    _sourceLocator.setClassPath(classPath);
  }

  public synchronized void setSourcePath(String sourcePath) {
    _sourceLocator.setClassPath(sourcePath);
    synchronized (resumeAfterVMStartAndConfigurationDoneLock) {
      if (configurationDone && isDebuggerPaused()) {
        // If source is set while the VM is already paused, the user is going to expect frames
        // to resolve now. Re-send the paused notification so the debug client UI updates. Also
        // check configurationDone because user won't care about frame information until then.
        try {
          resendVmPausedNotification();
        } catch (Exception e) {
          // It's possible the VM resumed before we were able to dump the threads.
          // Try async-breaking it and repeating the operation.
          _virtualMachine.suspend();
          resendVmPausedNotification();
          _virtualMachine.resume();
        }
      }
    }
  }

  public String getClassPath() {
    return _classPath;
  }

  public CommandInterpreterBase getInterpreter() {
    return _interpreter;
  }

  public NotificationChannel getNotificationChannel() {
    return _channel;
  }

  public FileManager getFileManager() {
    return _fileManager;
  }

  public void setEventThread(EventThread eventThread) {
    _eventThread = eventThread;
  }

  public EventThread getEventThread() {
    return _eventThread;
  }

  public synchronized void resendVmPausedNotification() {
    setVmPaused(_stopReason, _stopThread);
  }

  public synchronized void pauseVm(DebuggerStopReason stopReason, boolean needsResponse) {
    if (stopReason == DebuggerStopReason.NONE) {
      throw new IllegalArgumentException();
    }

    getVirtualMachine().suspend();
    setVmPaused(stopReason, null, needsResponse);
  }

  public synchronized void pauseVm(DebuggerStopReason stopReason) {
    pauseVm(stopReason, true /* needsResponse */);
  }

  public synchronized void resumeVm(boolean needsResponse) {
    // Resume the VM.
    setStopReason(DebuggerStopReason.NONE);
    getRemoteObjectManager().clearObjects();
    getVirtualMachine().resume();

    // If this is the loader breakpoint, issue a second resume command in case
    // we attached to a suspended VM. If the VM is not suspended, this call is
    // a no-op.
    if (_initialSuspend) {
      getVirtualMachine().resume();
      _initialSuspend = false;
    }

    if (needsResponse) {
      NotificationChannel channel = getNotificationChannel();
      if (channel instanceof VsDebugAdapterChannelManager) {
        JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
        javaDebuggerServer.sendContinuedEvent(getCurrentThread().uniqueID());
      } else {
        // Tell the client we're resumed.
        JSONObject notificationJson = new JSONObject();
        notificationJson.put("method", "Debugger.resumed");
        Utils.sendClientNotification(this, notificationJson);
      }
    }
  }

  public synchronized void setVmPaused(DebuggerStopReason stopReason, ThreadReference pauseThread) {
    setVmPaused(stopReason, pauseThread, true /* needsResponse */);
  }

  public synchronized void setVmPaused(
      DebuggerStopReason stopReason, ThreadReference pauseThread, boolean needsResponse) {
    setStopReason(stopReason);

    // NOTE: _stopThread is the thread (if any) responsible for causing the VM to suspend (due to
    // a breakpoint, exception, etc.). _currentThread is the currently selected thread. The two
    // may be the same after hitting a breakpoint, but while the debugger is paused, the user can
    // change _currentThread by selecting a different thread in the frontend.  _currentThread would
    // then be the thread that gets its callstack, locals, etc dumped.
    _stopThread = pauseThread;
    _currentThread = pauseThread;

    if (pauseThread == null && _virtualMachine.allThreads().size() > 0) {
      // If the VM was paused due to a non-locatable event, or by the frontend causing an
      // async-break, set the current thread to the "main" thread, or the first thread in the app.
      ThreadReference mainThread =
          _virtualMachine
              .allThreads()
              .stream()
              .filter(thread -> thread.name().equals("main"))
              .findFirst()
              .orElseGet(
                  () ->
                      _virtualMachine
                          .allThreads()
                          .stream()
                          .findFirst()
                          .orElseThrow(() -> new Error("There are no threads in the VM!")));

      _currentThread = mainThread;
    }

    synchronized (resumeAfterVMStartAndConfigurationDoneLock) {
      if (needsResponse && configurationDone) {
        NotificationChannel channel = getNotificationChannel();
        if (channel instanceof VsDebugAdapterChannelManager) {
          JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
          // send the current thread's thread notification first then send all the other threads'
          //   statuses, because VsDebugSessionTranslator sometimes considers the first thread sent
          //   to be the main paused thread
          javaDebuggerServer.sendDebuggerPausedNotification(_currentThread);
        } else {
          // Fetching threads list can be really slow for big app
          // send paused before threads notification to make enter paused state in UI first.
          _threadManager.sendDebuggerPausedNotification();
          _threadManager.sendThreadsNotification(_stopReason, _stopThread, _currentThread);
        }
      }
    }
  }

  public void handleThreadStartEvent(ThreadStartEvent event) {
    handleThreadStart(event.thread());
  }

  public void handleThreadStart(ThreadReference thread) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendThreadStartEvent(thread);
    }
  }

  public void handleThreadDeathEvent(ThreadDeathEvent event) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendThreadDeathEvent(event.thread());
    }
  }

  public void sendTelemetryEvent(String eventName, JSONObject values) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendTelemetryEvent(eventName, values);
    }
  }

  public void sendBreakpointHitcountNotification(BreakpointSpec breakpointSpec) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendBreakpointEvent(
          breakpointSpec, true /* verified */, Utils.BreakpointEventReasons.CHANGED);
    } else {
      Utils.sendBreakpointHitcountNotification(
          this, breakpointSpec.getId(), breakpointSpec.getHitCount());
    }
  }

  public void sendUserMessage(String message, Utils.UserMessageLevel level) {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendUserMessage(message, level);
    }
  }

  public void handleVMDeath() {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      // vs code debug protocol is a bit unclear on whether a terminated event or an exited event
      //   should be sent, so we are sending a terminated event
      javaDebuggerServer.sendTerminatedEvent();
    } else {
      Utils.sendClientNotification(this, new JSONObject().put("method", "Inspector.targetCrashed"));
    }
  }

  public void handleVMDisconnect() {
    NotificationChannel channel = getNotificationChannel();
    if (channel instanceof VsDebugAdapterChannelManager) {
      JavaDebuggerServer javaDebuggerServer = (JavaDebuggerServer) getInterpreter();
      javaDebuggerServer.sendTerminatedEvent();
    } else {
      Utils.sendClientNotification(
          this,
          new JSONObject().put("method", "Inspector.detached").put("reason", "Target detached"));
    }
  }

  public synchronized DebuggerStopReason getStopReason() {
    return _stopReason;
  }

  public synchronized ContextManager setStopReason(DebuggerStopReason stopReason) {
    _stopReason = stopReason;
    return this;
  }

  public synchronized boolean isDebuggerPaused() {
    return _stopReason != DebuggerStopReason.NONE;
  }

  public ExceptionManager getExceptionManager() {
    return _exceptionManager;
  }

  public EvaluationManager getEvaluationManager() {
    return _evaluationManager;
  }
}
