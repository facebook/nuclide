/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.IncompatibleThreadStateException;
import com.sun.jdi.StackFrame;
import com.sun.jdi.Value;
import com.sun.jdi.request.EventRequest;
import com.sun.jdi.request.EventRequestManager;
import com.sun.jdi.request.StepRequest;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Implements Nuclide debugger domain protocols. */
public class DebuggerDomain extends DomainHandlerBase {

  public DebuggerDomain(ContextManager contextManager) {
    super("Debugger", contextManager);
  }

  public JSONObject handleMethod(String id, String methodName, JSONObject params)
      throws DomainHandlerException {
    JSONObject result = new JSONObject();
    try {
      switch (methodName) {
        case "enable":
          enable();
          break;

        case "setBreakpointByUrl":
          result =
              setFileLineBreakpoint(
                  params.getString("url"),
                  params.getInt("lineNumber") + 1, // Chrome line number is 0-based.
                  params.optString("packageHint"),
                  params.optString("condition"));
          break;

        case "removeBreakpoint":
          removeBreakpoint(params.getString("breakpointId"));
          break;

        case "stepOver":
          stepOver();
          break;

        case "stepInto":
          stepInto();
          break;

        case "stepOut":
          stepOut();
          break;

        case "resume":
          resume();
          break;

        case "pause":
          pause();
          break;

        case "getThreadStack":
          result = getThreadStack(params.getInt("threadId"));
          break;

        case "addSourcePath":
          addSourcePath(params.getString("path"));
          break;

          // Test only.
        case "locals":
          printLocals();
          break;

        case "getScriptSource":
          result = getScriptSource();
          break;

        case "selectThread":
          selectThread(params.getInt("threadId"));
          break;

        case "evaluateOnCallFrame":
          result =
              evaluateOnCallFrame(params.getString("callFrameId"), params.getString("expression"));
          break;

        case "setPauseOnExceptions":
          setPauseOnExceptions(params.getString("state"));
          break;

        default:
          throwUndefinedMethodException(methodName);
          break;
      }
    } catch (Exception ex) {
      Utils.logException("Error handling command \"" + methodName + "\":", ex);
      throw ex;
    }

    return result;
  }

  private void setPauseOnExceptions(String state) {
    getContextManager().getExceptionManager().setPauseOnExceptions(state);
  }

  private JSONObject evaluateOnCallFrame(String frameId, String expression) {
    Utils.logVerbose("Evaluating expression \"" + expression + "\" on frame: " + frameId);

    JSONObject response = new JSONObject();
    try {
      Value value =
          getContextManager().getEvaluationManager().evaluateOnCallFrame(frameId, expression);
      RemoteObjectDescription description =
          new RemoteObjectDescription(getContextManager().getRemoteObjectManager(), value);
      JSONObject result = description.getSerializedObject();
      response.put("result", result);
      response.put("wasThrown", false);
    } catch (Exception ex) {
      Utils.logException("Failed to evaluate " + expression + " on frameId " + frameId, ex);
      JSONObject result = new JSONObject();
      result.put("type", "string");
      result.put("subtype", "error");
      result.put("value", ex.toString());

      StringWriter sw = new StringWriter();
      ex.printStackTrace(new PrintWriter(sw));
      result.put("exceptionDetails", sw.toString());
      response.put("result", result);
      response.put("wasThrown", true);
    }

    return response;
  }

  private void addSourcePath(String path) {
    getContextManager().getSourceLocator().addPotentialPath(path);
  }

  private JSONObject getScriptSource() {
    JSONObject source = new JSONObject();
    source.put("scriptSource", "");
    return source;
  }

  private void selectThread(int threadId) {
    getContextManager().setCurrentThread(threadId);
  }

  private JSONObject getThreadStack(int threadId) {
    JSONArray callFrames = getContextManager().getThreadManager().getThreadStack(threadId);
    JSONObject threadStack = new JSONObject();
    threadStack.put("callFrames", callFrames);
    return threadStack;
  }

  private void printLocals() {
    StackFrame currentFrame = null;
    try {
      currentFrame = getContextManager().getCurrentThread().frame(0);
      RemoteObject localsRemoteObject =
          getContextManager().getRemoteObjectManager().registerLocals(currentFrame);
      Utils.logInfo(localsRemoteObject.getSerializedValue().toString());
    } catch (IncompatibleThreadStateException e) {
      e.printStackTrace();
    }
  }

  private void removeBreakpoint(String breakpointId) {
    getContextManager().getBreakpointManager().removeBreakpoint(breakpointId);
  }

  private void enable() {
    getContextManager().getNotificationChannel().enable();
  }

  public void resume() {
    clearPreviousSteps();
    resumeVM();
  }

  private void pause() {
    getContextManager().pauseVm(DebuggerStopReason.ASYNC_BREAK);
  }

  private JSONObject setFileLineBreakpoint(
      String fileUrl, int line, String packageHint, String condition) {
    String filePath = Utils.getFilePathFromUrl(fileUrl);
    String breakpointId =
        getContextManager()
            .getBreakpointManager()
            .setFileLineBreakpoint(filePath, line, packageHint, condition);
    BreakpointSpec breakpoint =
        getContextManager().getBreakpointManager().getBreakpointFromId(breakpointId);
    return getBreakpointJson(breakpoint);
  }

  private JSONObject getBreakpointJson(BreakpointSpec breakpoint) {
    JSONObject result = new JSONObject();
    result.put("breakpointId", breakpoint.getId());
    result.put("resolved", breakpoint.isResolved());

    JSONArray locationsJson = new JSONArray();
    locationsJson.put(breakpoint.getLocationJson());
    result.put("locations", locationsJson);
    return result;
  }

  public void stepOver() {
    generalStep(StepRequest.STEP_OVER);
  }

  public void stepInto() {
    generalStep(StepRequest.STEP_INTO);
  }

  public void stepOut() {
    generalStep(StepRequest.STEP_OUT);
  }

  private void generalStep(int stepKind) {
    clearPreviousSteps();
    EventRequestManager eventRequestManager =
        getContextManager().getVirtualMachine().eventRequestManager();
    StepRequest stepRequest =
        eventRequestManager.createStepRequest(
            getContextManager().getCurrentThread(), StepRequest.STEP_LINE, stepKind);
    stepRequest.setSuspendPolicy(EventRequest.SUSPEND_ALL);
    stepRequest.enable();
    resumeVM();
  }

  private void resumeVM() {
    getContextManager().resumeVm(true);
  }

  private void clearPreviousSteps() {
    EventRequestManager eventRequestManager =
        getContextManager().getVirtualMachine().eventRequestManager();

    // Copy pending remove requests into a new collection to prevent
    // ConcurrentModificationException.
    List<StepRequest> prevSteps = new ArrayList<>();
    for (StepRequest stepRequest : eventRequestManager.stepRequests()) {
      if (stepRequest.thread() == getContextManager().getCurrentThread()) {
        prevSteps.add(stepRequest);
      }
    }

    for (StepRequest stepRequest : prevSteps) {
      eventRequestManager.deleteEventRequest(stepRequest);
    }
  }
}
