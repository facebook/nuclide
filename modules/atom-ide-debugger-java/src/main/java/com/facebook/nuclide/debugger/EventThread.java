/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.BooleanValue;
import com.sun.jdi.Location;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.VMDisconnectedException;
import com.sun.jdi.Value;
import com.sun.jdi.event.BreakpointEvent;
import com.sun.jdi.event.ClassPrepareEvent;
import com.sun.jdi.event.Event;
import com.sun.jdi.event.EventIterator;
import com.sun.jdi.event.EventQueue;
import com.sun.jdi.event.EventSet;
import com.sun.jdi.event.ExceptionEvent;
import com.sun.jdi.event.LocatableEvent;
import com.sun.jdi.event.StepEvent;
import com.sun.jdi.event.ThreadDeathEvent;
import com.sun.jdi.event.ThreadStartEvent;
import com.sun.jdi.event.VMDeathEvent;
import com.sun.jdi.event.VMDisconnectEvent;
import com.sun.jdi.event.VMStartEvent;
import java.util.List;

/** This class processes incoming JDI events. */
public class EventThread extends Thread {
  private final ContextManager _contextManager;
  private final EventQueue _eventQueue;
  private final AppExitEvent _appExitEvent;
  private boolean _connected = true; // Connected to VM.
  private boolean _vmDied = false; // VMDeath occurred.

  EventThread(ContextManager contextManager, EventQueue eventQueue, AppExitEvent appExitEvent) {
    super("event-handler");
    _contextManager = contextManager;
    _eventQueue = eventQueue;
    _appExitEvent = appExitEvent;
  }

  /**
   * Run the event handling thread. As long as we are connected, get event sets off the queue and
   * dispatch the events within them.
   */
  @Override
  public void run() {
    try {
      while (_connected) {
        try {
          EventSet eventSet = _eventQueue.remove();
          EventIterator it = eventSet.eventIterator();
          boolean resume = true;
          while (it.hasNext()) {
            resume &= handleEvent(it.nextEvent());
          }
          if (resume) {
            eventSet.resume();
          }
        } catch (VMDisconnectedException discExc) {
          handleDisconnectedException();
          break;
        } catch (Exception ex) {
          Utils.logException("Failed to handle event:", ex);
          throw ex;
        }
      }
    } catch (InterruptedException e) {
      // Someone notified us to exit.
    }

    _appExitEvent.notifyExit();
  }

  /** Dispatch incoming events */
  private boolean handleEvent(Event event) {
    boolean resume = true;

    if (event instanceof VMDeathEvent) {
      handleVMDeathEvent((VMDeathEvent) event);
    } else if (event instanceof VMDisconnectEvent) {
      handleVMDisconnectEvent((VMDisconnectEvent) event);
    } else if (event instanceof ClassPrepareEvent) {
      _contextManager.handleClassPrepareEvent((ClassPrepareEvent) event);
    } else if (event instanceof BreakpointEvent) {
      resume = handleBreakpoint((BreakpointEvent) event);
    } else if (event instanceof VMStartEvent
        || event instanceof StepEvent
        || event instanceof ExceptionEvent) {
      if (event instanceof VMStartEvent) {
        _contextManager.receivedVMStartEvent();
      }
      handleDebuggerPause(event);
      resume = false;
    } else if (event instanceof ThreadStartEvent) {
      _contextManager.handleThreadStartEvent((ThreadStartEvent) event);
    } else if (event instanceof ThreadDeathEvent) {
      _contextManager.handleThreadDeathEvent((ThreadDeathEvent) event);
    } else {
      // TODO:
    }
    return resume;
  }

  public boolean handleBreakpoint(BreakpointEvent event) {
    boolean resume;
    Location loc = event.location();

    if (loc != null) {
      resume = !(evaluateConditionalBreakAtLocation(loc));
    } else {
      // If the event doesn't specify a stop location, we cannot perform a condition
      // evaluation because there is no frame context for the eval. Break in.
      resume = false;
    }

    if (!resume) {
      handleDebuggerPause(event);
    }
    return resume;
  }

  private void recordBreakpointHit(BreakpointSpec spec) {
    if (spec.incrementHitCount() > 0) {
      // Inform the front-end of the breakpoint's new hit count.
      _contextManager.sendBreakpointHitcountNotification(spec);
    }
  }

  /**
   * Evaluates conditions, if any, for all breakpoints at the specified location. Returns true if
   * the debugger should break in, false if it should resume execution.
   */
  private boolean evaluateConditionalBreakAtLocation(Location loc) {
    List<BreakpointSpec> breakpointsAtLocation =
        _contextManager.getBreakpointManager().getBreakpointsAtLocation(loc);
    if (breakpointsAtLocation.isEmpty()) {
      // No matching breakpoints at the specified location.
      return true;
    }

    DebuggerStopReason stopReason = _contextManager.getStopReason();
    // In order to evaluate the condition, the evaluation manager must believe that the
    // debugee is paused, which it is, but the context manager doesn't as of yet know that
    _contextManager.setStopReason(DebuggerStopReason.BREAKPOINT);
    try {
      ThreadReference thread = _contextManager.getCurrentThread();
      String frameId = Utils.getFrameName(thread.frames().get(0));

      for (BreakpointSpec spec : breakpointsAtLocation) {
        try {
          String condition = spec.getCondition();
          if (condition == null || condition.trim().equals("")) {
            // This breakpoint has no condition and should break.
            recordBreakpointHit(spec);
            return true;
          }

          // Evaluate the condition.
          Value value =
              _contextManager.getEvaluationManager().evaluateOnCallFrame(frameId, condition);
          if (!(value instanceof BooleanValue) || ((BooleanValue) value).value() == true) {
            // Expression did not evaluate to a boolean, or it did and the boolean indicates
            // we should break.
            recordBreakpointHit(spec);
            return true;
          }
        } catch (Exception ex) {
          recordBreakpointHit(spec);
          throw ex;
        }
      }
    } catch (Exception ex) {
      Utils.sendUserMessage(
          _contextManager,
          "Failed to evaluate breakpoint condition: " + ex.toString(),
          Utils.UserMessageLevel.ERROR,
          true);

      return true;
    } finally {
      _contextManager.setStopReason(stopReason);
    }

    return false;
  }

  private static DebuggerStopReason getStopReasonForEvent(Event event) {
    if (event instanceof VMStartEvent) {
      return DebuggerStopReason.LOADER_BREAK;
    } else if (event instanceof BreakpointEvent) {
      return DebuggerStopReason.BREAKPOINT;
    } else if (event instanceof StepEvent) {
      return DebuggerStopReason.SINGLE_STEP;
    } else if (event instanceof ExceptionEvent) {
      ExceptionEvent exn = (ExceptionEvent) event;
      Utils.logInfo("Breaking on debugee exception: " + exn.exception().referenceType().name());
      return DebuggerStopReason.EXCEPTION;
    }

    return null;
  }

  /** Get the ThreadReference for the thread responsible for the specified VM event. */
  private static ThreadReference getEventThread(Event event) {
    if (event instanceof LocatableEvent) {
      return ((LocatableEvent) event).thread();
    }

    // Only LocatableEvents have an associated thread.
    return null;
  }

  private void handleDebuggerPause(Event event) {
    _contextManager.setVmPaused(getStopReasonForEvent(event), getEventThread(event));
  }

  /**
   * A VMDisconnectedException has happened while dealing with another event. We need to flush the
   * event queue, dealing only with exit events (VMDeath, VMDisconnect) so that we terminate
   * correctly.
   */
  private void handleDisconnectedException() throws InterruptedException {
    try {
      while (_connected) {
        EventSet eventSet = _eventQueue.remove();
        EventIterator iter = eventSet.eventIterator();
        while (iter.hasNext()) {
          Event event = iter.nextEvent();
          if (event instanceof VMDeathEvent) {
            handleVMDeathEvent((VMDeathEvent) event);
          } else if (event instanceof VMDisconnectEvent) {
            handleVMDisconnectEvent((VMDisconnectEvent) event);
          }
        }
        eventSet.resume(); // Resume the VM
      }
    } catch (VMDisconnectedException discExc) {
      // Couldn't flush the queue. Behave as if we found the disconnect event.
      // This will inform the debugger client that the session has disconnected, which
      // will prompt it to tear down the debugger.
      Utils.logException("Disconnected exception while draining event queue:", discExc);
      handleVMDisconnectEvent(null);
    }
  }

  private void handleVMDeathEvent(VMDeathEvent event) {
    _vmDied = true;
    Utils.logInfo("-- The application exited --");

    Utils.logVerboseException(event.toString(), new Throwable());
    _contextManager.handleVMDeath();

    // There is no more VM to talk to. Kill the debug server.
    System.exit(0);
  }

  private void handleVMDisconnectEvent(VMDisconnectEvent event) {
    _connected = false;
    if (!_vmDied) {
      _contextManager.sendUserMessage(
          "VM Disconnected. This may be a result of a native crash. Use a Native debugger to investigate.",
          Utils.UserMessageLevel.INFO);

      Utils.logInfo("-- The application has been disconnected --");

      Utils.logVerboseException(event != null ? event.toString() : "", new Throwable());
      _contextManager.handleVMDisconnect();

      // There is no more VM to talk to. Kill the debug server.
      System.exit(0);
    }
  }
}
