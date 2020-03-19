/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

package com.facebook.nuclide.debugger;

import com.sun.jdi.AbsentInformationException;
import com.sun.jdi.IncompatibleThreadStateException;
import com.sun.jdi.InvalidStackFrameException;
import com.sun.jdi.LocalVariable;
import com.sun.jdi.ThreadReference;
import com.sun.jdi.VMDisconnectedException;
import com.sun.jdi.Value;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class JavaDebuggerServer extends CommandInterpreterBase {
  private static final String UNKNOWN = "Unknown";
  private static final Comparator<Variable> VARIABLE_COMPARATOR =
      ((Variable v1, Variable v2) -> {
        String n1 = v1.getName();
        String n2 = v2.getName();
        try {
          if (n1.startsWith("[") && n2.startsWith("[") && n1.endsWith("]") && n2.endsWith("]")) {
            // n1 and n2 are of the form \[.*\]
            String subString1 = n1.substring(1, n1.length() - 1);
            String subString2 = n2.substring(1, n2.length() - 1);
            Integer arrayIndex1 = Integer.valueOf(subString1);
            Integer arrayIndex2 = Integer.valueOf(subString2);
            return arrayIndex1 - arrayIndex2;
          }
        } catch (NumberFormatException ex) {
          // default to natural order compare
        }
        return n1.compareTo(n2);
      });
  private InputStream inputStream = System.in;
  private OutputStream outputStream = System.out;
  private int stackFrameSeq = 0;
  private static final AppExitEvent appExitEvent = new AppExitEvent();
  private final HashMap<String, ArrayList<BreakpointSpec>> registeredBreakpointsByFileName =
      new HashMap<String, ArrayList<BreakpointSpec>>();
  private final HashMap<String, BreakpointSpec> registeredBreakpoints =
      new HashMap<String, BreakpointSpec>();
  private final HashMap<String, Source> breakpointIdToSource = new HashMap<String, Source>();
  private final HashMap<Integer, Consumer<base$Response>> pendingRequests =
      new HashMap<Integer, Consumer<base$Response>>();
  private final Utils utilsInstance = new Utils();
  private boolean linesStartAt1 = true;

  public JavaDebuggerServer() {
    super(new VsDebugAdapterChannelManager(), appExitEvent);
  }

  public void start() {
    VsDebugAdapterChannelManager channelManager =
        (VsDebugAdapterChannelManager) getContextManager().getNotificationChannel();
    channelManager.start(this);
  }

  public InputStream inputStream() {
    return inputStream;
  }

  public OutputStream outputStream() {
    return outputStream;
  }

  public void send(base$ProtocolMessage message) {
    // uncomment the following line for easier debugging
    // Utils.logVerbose("SENDING " + message.toJSON().toString(2));
    VsDebugAdapterChannelManager channelManager =
        (VsDebugAdapterChannelManager) getContextManager().getNotificationChannel();
    channelManager.sendProtocolMessage(message);
  }

  public void send(base$Request request, Consumer<base$Response> callback) {
    pendingRequests.put(request.seq, callback);
    VsDebugAdapterChannelManager channelManager =
        (VsDebugAdapterChannelManager) getContextManager().getNotificationChannel();
    channelManager.sendProtocolMessage(request);
  }

  private int getNextStackFrameId() {
    return ++stackFrameSeq;
  }

  private void populateMapsForNewStackFrame(
      int stackFrameId, int stackFrameIndex, ThreadReference thread) {
    getFrameIdToThreadMap().put(stackFrameId, thread);
    getFrameIdToStackFrameIndexMap().put(stackFrameId, stackFrameIndex);
  }

  public Breakpoint breakpointSpecToBreakpoint(BreakpointSpec breakpointSpec) {
    return breakpointSpecToBreakpoint(breakpointSpec, breakpointSpec.isResolved());
  }

  public Breakpoint breakpointSpecToBreakpoint(BreakpointSpec breakpointSpec, boolean verified) {
    return new Breakpoint(
        breakpointSpec.getIdAsInt(),
        verified,
        "" /* message */,
        breakpointIdToSource.get(breakpointSpec.getId()),
        breakpointSpec.getLine(),
        null /* column */,
        null /* endLine */,
        null /* endColumn */,
        breakpointSpec.getHitCount());
  }

  private Value evaluateExpression(com.sun.jdi.StackFrame frame, String expression)
      throws Exception {
    return getContextManager().getEvaluationManager().evaluateOnCallFrame(frame, expression);
  }

  private void handleInitializeRequest(JSONObject arguments, InitializeResponse response) {
    linesStartAt1 = arguments.optBoolean("linesStartAt1", true);
    JSONObject allExceptionsFilter =
        new JSONObject().put("label", "All Exceptions").put("filter", "all");
    JSONObject uncaughtExceptionsFilter =
        new JSONObject().put("label", "Uncaught Exceptions").put("filter", "uncaught");
    JSONArray exceptionBreakpointFilters =
        new JSONArray().put(allExceptionsFilter).put(uncaughtExceptionsFilter);
    JSONObject capabilities =
        new JSONObject()
            .put("exceptionBreakpointFilters", exceptionBreakpointFilters)
            .put("supportsConditionalBreakpoints", true)
            .put("supportsConfigurationDoneRequest", true)
            .put("supportsDelayedStackTraceLoading", true)
            .put("supportsEvaluateForHovers", true)
            .put("supportsSetVariable", true)
            .put("supportTerminateDebuggee", false);
    send(response.setBody(capabilities));
  }

  private void handleSetExceptionBreakpointsRequest(
      SetExceptionBreakpointsArguments arguments, SetExceptionBreakpointsResponse response) {
    ExceptionManager exceptionManager = getContextManager().getExceptionManager();
    if (arguments.filters.size() == 0) {
      exceptionManager.setPauseOnExceptions("none");
    } else if (arguments.filters.size() == 2) {
      // in case filters come in out of order
      exceptionManager.setPauseOnExceptions("all");
    } else {
      exceptionManager.setPauseOnExceptions(arguments.filters.get(0));
    }
    send(response);
  };

  private void handleAttachRequest(JSONObject arguments, AttachResponse response) {
    int port = -1;
    try {
      port = arguments.getInt("javaJdwpPort");
    } catch (Exception ex) {
      // We used to use port in the config but now we use javaJdwpPort.
      // This line is here just in case we missed a spot when switching to using javaJdwpPort.
      port = arguments.getInt("port");
    }
    try {
      // when attaching, vm may already be started, assume it has
      getContextManager().receivedVMStartEvent();
      getContextManager().getBootstrapDomain().attachPort(port, "" /* sourcePath */);
      send(response);
      send(new InitializedEvent());
    } catch (JSONException | DomainHandlerException ex) {
      Utils.logException("Error trying to attach:", ex);
    }
  }

  private void handleLaunchRequest(JSONObject arguments, LaunchResponse response) {
    try {
      String console = arguments.optString("console");
      JSONArray runArgsNullable = arguments.optJSONArray("runArgs");
      JSONArray runArgs = runArgsNullable != null ? runArgsNullable : new JSONArray();
      String entryPointClass = arguments.getString("entryPointClass");
      String classPath = arguments.getString("classPath");
      if (console != null
          && (console.equals("integratedTerminal") || console.equals("externalConsole"))) {
        String args = BootstrapDomain.getArgStringFromArgs(runArgs);
        // set class path to insert class path into process command list
        getContextManager().setClassPath(classPath);
        List<String> processCommandList =
            JVMConnector.getProcessCommandList(getContextManager(), entryPointClass, args);
        String title = "Java Debug Console - " + entryPointClass;
        RunInTerminalRequest runInTerminalRequest =
            (new RunInTerminalRequest(console.equals("integratedTerminal")))
                .setTitle(title)
                .setCWD(classPath)
                .setArgs(processCommandList);
        send(
            runInTerminalRequest,
            runInTerminalResponse -> {
              if (runInTerminalResponse.success) {
                getContextManager().receivedVMStartEvent();
                try {
                  getContextManager().getBootstrapDomain().attachPort(JVMConnector.TARGET_PORT, "");
                  send(new InitializedEvent());
                } catch (DomainHandlerException ex) {
                  response.setSuccess(false);
                  response.setMessage(ex.toString());
                }
                send(response);
              } else {
                response.setSuccess(false);
                response.setMessage("Run In Terminal Failed.");
                send(response);
              }
            });
      } else {
        getContextManager()
            .getBootstrapDomain()
            .launch(entryPointClass, classPath, runArgs, "" /* sourcePath */);
        send(new InitializedEvent());
        send(response);
      }
    } catch (JSONException | DomainHandlerException ex) {
      response.setSuccess(false);
      response.setMessage(ex.toString());
      send(response);
    }
  }

  private void handleSetBreakpointsRequest(
      SetBreakpointsArguments arguments, SetBreakpointsResponse response) {
    BreakpointManager bm = getContextManager().getBreakpointManager();
    Source source = arguments.source;
    String path = source.path;
    String nullableHint = utilsInstance.getHintForFilePath(path);
    String hint = nullableHint != null ? nullableHint : "";

    if (!registeredBreakpointsByFileName.containsKey(path)) {
      registeredBreakpointsByFileName.put(path, new ArrayList<BreakpointSpec>());
    }

    Set<String> hashOfBreakpointsToAdd =
        arguments
            .breakpoints
            .stream()
            .map(
                sourceBreakpoint ->
                    String.valueOf(sourceBreakpoint.line) + sourceBreakpoint.condition)
            .collect(Collectors.toSet());
    ArrayList<BreakpointSpec> registeredBreakpointsForCurrentPath =
        registeredBreakpointsByFileName.get(path);
    Set<BreakpointSpec> breakpointSpecsToRemove =
        registeredBreakpointsForCurrentPath
            .stream()
            .filter(
                breakpointSpec ->
                    !hashOfBreakpointsToAdd.contains(
                        String.valueOf(breakpointSpec.getLine()) + breakpointSpec.getCondition()))
            .collect(Collectors.toSet());

    List<JSONObject> responseBreakpointsList =
        path.endsWith(".java")
            ? arguments
                .breakpoints
                .stream()
                .map(
                    newSourceBreakpoint -> {
                      // see if we already have this breakpoint
                      BreakpointSpec breakpointSpec =
                          registeredBreakpointsForCurrentPath
                              .stream()
                              .filter(
                                  oldBreakpointSpec ->
                                      oldBreakpointSpec.getLine() == newSourceBreakpoint.line)
                              .filter(
                                  oldBreakpointSpec ->
                                      oldBreakpointSpec
                                          .getCondition()
                                          .equals(newSourceBreakpoint.condition))
                              .findAny()
                              .orElse(null);
                      // otherwise, create a new breakpoint
                      if (breakpointSpec == null) {
                        String breakpointId =
                            bm.setFileLineBreakpoint(
                                path,
                                newSourceBreakpoint.line,
                                hint,
                                newSourceBreakpoint.condition);
                        breakpointSpec = bm.getBreakpointFromId(breakpointId);

                        breakpointIdToSource.put(breakpointId, source);
                        registeredBreakpoints.put(breakpointId, breakpointSpec);
                        registeredBreakpointsForCurrentPath.add(breakpointSpec);
                      }
                      return breakpointSpec;
                    })
                .map(this::breakpointSpecToBreakpoint)
                .map(Breakpoint::toJSON)
                .collect(Collectors.toList())
            : new ArrayList<JSONObject>();

    breakpointSpecsToRemove
        .stream()
        .map(BreakpointSpec::getId)
        .forEach(
            id -> {
              bm.removeBreakpoint(id);
              registeredBreakpoints.remove(id);
              breakpointIdToSource.remove(id);
            });
    registeredBreakpointsForCurrentPath.removeAll(breakpointSpecsToRemove);

    JSONArray responseBreakpoints = new JSONArray(responseBreakpointsList);
    JSONObject body = new JSONObject().put("breakpoints", responseBreakpoints);
    send(response.setBody(body));
  }

  private void handleStackTraceRequest(StackTraceArguments arguments, StackTraceResponse response) {
    try {
      ThreadReference thread =
          getContextManager()
              .getVirtualMachine()
              .allThreads()
              .parallelStream()
              .filter(t -> t.uniqueID() == arguments.threadId)
              .findFirst()
              .orElse(null);
      try {
        List<com.sun.jdi.StackFrame> jdiStackFrames = thread.frames();
        int totalFrames = jdiStackFrames.size();
        int endExclusive =
            arguments.levels != 0
                ? Math.min(arguments.startFrame + arguments.levels, jdiStackFrames.size())
                : jdiStackFrames.size();
        List<JSONObject> stackFrames =
            IntStream.range(arguments.startFrame, endExclusive)
                .mapToObj(
                    stackFrameIndex -> {
                      com.sun.jdi.StackFrame frame = jdiStackFrames.get(stackFrameIndex);
                      String name;
                      try {
                        name = frame.location().sourceName();
                      } catch (AbsentInformationException ex) {
                        // This seems to happen for one particular stack frame in the Android
                        //   internals but since VsDebugSessionTranslator doesn't actually use
                        //   the stack frame's source's name, this value is ultimately ignored
                        name = UNKNOWN;
                      }
                      String relativePath;
                      try {
                        relativePath = frame.location().sourcePath();
                      } catch (AbsentInformationException ex) {
                        relativePath = null;
                      }
                      try {
                        String path =
                            relativePath != null
                                ? getContextManager()
                                    .getSourceLocator()
                                    .findSourceFile(relativePath)
                                    .map(file -> file.getAbsolutePath())
                                    .orElse(null)
                                : null;
                        Source frameSource = new Source(name, path);
                        int stackFrameId = getNextStackFrameId();
                        populateMapsForNewStackFrame(stackFrameId, stackFrameIndex, thread);
                        return new StackFrame(
                            stackFrameId,
                            frame.location().method().name(),
                            frameSource,
                            frame.location().lineNumber() - (linesStartAt1 ? 0 : 1),
                            1 /* column */);
                      } catch (InvalidStackFrameException ex) {
                        Utils.logVerboseException(frame.toString(), ex);
                        return null;
                      }
                    })
                .filter(Objects::nonNull)
                .map(StackFrame::toJSON)
                .collect(Collectors.toList());
        JSONObject body =
            new JSONObject()
                .put("stackFrames", new JSONArray(stackFrames))
                .put("totalFrames", totalFrames);
        response.setBody(body);
      } catch (Exception ex) {
        Utils.logVerboseException("Error in trying to get stackframes:", ex);
        response.setSuccess(false);
        response.setMessage(ex.toString());
      }
      send(response);
    } catch (VMDisconnectedException ex) {
      // sometimes we get stackTraceRequests after program execution is done
      // this seems to happen on small, trivial programs
      Utils.logVerboseException("", ex);
    }
  }

  private void handleConfigurationDoneRequest(ConfigurationDoneResponse response) {
    // arguments has no data, it is just an indication that a request came in
    send(response);
    // now that configuration done request has come in, we can resume safely without having to
    //   worry that we run past a not yet set breakpoint, but we must delegate to the context
    //   manager to make sure that the resume command comes in after the VMStartEvent
    getContextManager().receivedConfigurationDoneRequest();
  }

  private void handleScopesRequest(ScopesArguments arguments, ScopesResponse response) {
    JSONArray scopes = new JSONArray();
    try {
      com.sun.jdi.StackFrame frame = getStackFrameForFrameId(arguments.frameId);
      int scopeId = getContextManager().getRemoteObjectManager().registerLocals(frame).getIdAsInt();
      getScopeIdToFrameIdMap().put(scopeId, arguments.frameId);
      scopes.put(new Scope("Locals", scopeId).toJSON());
    } catch (Exception ex) {
      Utils.logException("Error trying to get scopes:", ex);
    }
    send(response.setScopes(scopes));
  }

  private void handleEvaluateRequest(EvaluateArguments arguments, EvaluateResponse response) {
    RemoteObjectManager rom = getContextManager().getRemoteObjectManager();
    try {
      com.sun.jdi.StackFrame frame = getStackFrameForFrameId(arguments.frameId);
      Value value = evaluateExpression(frame, arguments.expression);
      RemoteObjectDescription description = new RemoteObjectDescription(rom, value);
      String objectId = description._objectId;
      response.setResult(description._description);
      response.setType(description._chromeType);
      response.setVariablesReference(objectId == null ? 0 : rom.getObject(objectId).getIdAsInt());
    } catch (Exception ex) {
      response.setSuccess(false);
      response.setMessage(ex.toString());
    }
    send(response);
  }

  private void handleSetVariableRequest(
      SetVariableArguments arguments, SetVariableResponse response) {
    try {
      // arguments.variablesReference for a SetVariable request actually references the scope
      RemoteObjectManager rom = getContextManager().getRemoteObjectManager();
      Integer frameId = getScopeIdToFrameIdMap().get(arguments.variablesReference);
      com.sun.jdi.StackFrame stackFrame = getStackFrameForFrameId(frameId);
      LocalVariable variable =
          stackFrame
              .visibleVariables()
              .parallelStream()
              .filter(v -> v.name().equals(arguments.name))
              .findAny()
              .orElse(null);
      Value newValue = evaluateExpression(stackFrame, arguments.value);
      stackFrame.setValue(variable, newValue);
      RemoteObjectDescription description = new RemoteObjectDescription(rom, newValue);
      String objectId = description._objectId;
      int objectIdAsInt = objectId == null ? 0 : rom.getObject(objectId).getIdAsInt();
      response
          .setValue(description._description)
          .setType(description._chromeType)
          .setVariablesReference(objectIdAsInt);
    } catch (Exception ex) {
      Utils.logVerboseException("Set Variable Error:", ex);
      response.setSuccess(false);
      response.setMessage(ex.toString());
    }
    send(response);
  }

  private void handleThreadsRequest(ThreadsResponse response) {
    List<JSONObject> threads =
        getContextManager()
            .getVirtualMachine()
            .allThreads()
            .parallelStream()
            .map(thread -> new JSONObject().put("id", thread.uniqueID()).put("name", thread.name()))
            .collect(Collectors.toList());
    send(response.setThreads(threads));
  }

  private void handleContinueRequest(ContinueResponse response) {
    getContextManager().getDebuggerDomain().resume();
    send(response.setAllThreadsContinued(true));
  }

  private void handleNextRequest(NextResponse response) {
    getContextManager().getDebuggerDomain().stepOver();
    send(response);
  }

  private void handleStepInRequest(StepInResponse response) {
    getContextManager().getDebuggerDomain().stepInto();
    send(response);
  }

  private void handleStepOutRequest(StepOutResponse response) {
    getContextManager().getDebuggerDomain().stepOut();
    send(response);
  }

  private void handleDisconnectRequest(DisconnectResponse response) {
    send(response);
    System.exit(0);
  }

  private void handleVariablesRequest(VariablesArguments arguments, VariablesResponse response) {
    RemoteObject remoteObject =
        getContextManager().getRemoteObjectManager().getObject(arguments.variablesReference);
    JSONArray remoteObjectProperties =
        remoteObject != null
            ? remoteObject.getProperties().optJSONArray("result")
            : new JSONArray();
    List<JSONObject> variables =
        Utils.jsonObjectArrayListFrom(remoteObjectProperties)
            .stream()
            .map(Variable::new)
            .sorted(VARIABLE_COMPARATOR)
            .map(Variable::toJSON)
            .collect(Collectors.toList());
    send(response.setVariables(variables));
  }

  private void handlePauseRequest(PauseResponse response) {
    getContextManager().pauseVm(DebuggerStopReason.ASYNC_BREAK);
    send(response);
  }

  private void handleSetSourcePathRequest(
      SetSourcePathArguments arguments, SetSourcePathResponse response) {
    getContextManager().setSourcePath(arguments.sourcePath);
    send(response);
  }

  private boolean dispatchRequest(String command, JSONObject requestJSON) {
    switch (command) {
      case "attach":
        {
          AttachRequest request = new AttachRequest(requestJSON);
          AttachResponse response = new AttachResponse(request.seq);
          handleAttachRequest(request.arguments, response);
          break;
        }
      case "configurationDone":
        {
          ConfigurationDoneRequest request = new ConfigurationDoneRequest(requestJSON);
          ConfigurationDoneResponse response = new ConfigurationDoneResponse(request.seq);
          handleConfigurationDoneRequest(response);
          break;
        }
      case "continue":
        {
          ContinueRequest request = new ContinueRequest(requestJSON);
          ContinueResponse response = new ContinueResponse(request.seq);
          handleContinueRequest(response);
          break;
        }
      case "disconnect":
        {
          DisconnectRequest request = new DisconnectRequest(requestJSON);
          DisconnectResponse response = new DisconnectResponse(request.seq);
          handleDisconnectRequest(response);
          break;
        }
      case "evaluate":
        {
          EvaluateRequest request = new EvaluateRequest(requestJSON);
          EvaluateResponse response = new EvaluateResponse(request.seq);
          handleEvaluateRequest(request.arguments, response);
          break;
        }
      case "initialize":
        {
          InitializeRequest request = new InitializeRequest(requestJSON);
          InitializeResponse response = new InitializeResponse(request.seq);
          handleInitializeRequest(request.arguments, response);
          break;
        }
      case "launch":
        {
          LaunchRequest request = new LaunchRequest(requestJSON);
          LaunchResponse response = new LaunchResponse(request.seq);
          handleLaunchRequest(request.arguments, response);
          break;
        }
      case "next":
        {
          NextRequest request = new NextRequest(requestJSON);
          NextResponse response = new NextResponse(request.seq);
          handleNextRequest(response);
          break;
        }
      case "setSourcePath":
        {
          SetSourcePathRequest request = new SetSourcePathRequest(requestJSON);
          SetSourcePathResponse response = new SetSourcePathResponse(request.seq);
          handleSetSourcePathRequest(request.arguments, response);
          break;
        }
      case "pause":
        {
          PauseRequest request = new PauseRequest(requestJSON);
          PauseResponse response = new PauseResponse(request.seq);
          handlePauseRequest(response);
          break;
        }
      case "scopes":
        {
          ScopesRequest request = new ScopesRequest(requestJSON);
          ScopesResponse response = new ScopesResponse(request.seq);
          handleScopesRequest(request.arguments, response);
          break;
        }
      case "setBreakpoints":
        {
          SetBreakpointsRequest request = new SetBreakpointsRequest(requestJSON);
          SetBreakpointsResponse response = new SetBreakpointsResponse(request.seq);
          handleSetBreakpointsRequest(request.arguments, response);
          break;
        }
      case "setExceptionBreakpoints":
        {
          SetExceptionBreakpointsRequest request = new SetExceptionBreakpointsRequest(requestJSON);
          SetExceptionBreakpointsResponse response =
              new SetExceptionBreakpointsResponse(request.seq);
          handleSetExceptionBreakpointsRequest(request.arguments, response);
          break;
        }
      case "setVariable":
        {
          SetVariableRequest request = new SetVariableRequest(requestJSON);
          SetVariableResponse response = new SetVariableResponse(request.seq);
          handleSetVariableRequest(request.arguments, response);
          break;
        }
      case "stackTrace":
        {
          StackTraceRequest request = new StackTraceRequest(requestJSON);
          StackTraceResponse response = new StackTraceResponse(request.seq);
          handleStackTraceRequest(request.arguments, response);
          break;
        }
      case "stepIn":
        {
          StepInRequest request = new StepInRequest(requestJSON);
          StepInResponse response = new StepInResponse(request.seq);
          handleStepInRequest(response);
          break;
        }
      case "stepOut":
        {
          StepOutRequest request = new StepOutRequest(requestJSON);
          StepOutResponse response = new StepOutResponse(request.seq);
          handleStepOutRequest(response);
          break;
        }
      case "threads":
        {
          ThreadsRequest request = new ThreadsRequest(requestJSON);
          ThreadsResponse response = new ThreadsResponse(request.seq);
          handleThreadsRequest(response);
          break;
        }
      case "variables":
        {
          VariablesRequest request = new VariablesRequest(requestJSON);
          VariablesResponse response = new VariablesResponse(request.seq);
          handleVariablesRequest(request.arguments, response);
          break;
        }
      default:
        return false;
    }
    return true;
  }

  private boolean dispatchResponse(String command, JSONObject requestJSON) {
    switch (command) {
      case "runInTerminal":
        {
          RunInTerminalResponse response = new RunInTerminalResponse(requestJSON);
          pendingRequests.get(response.request_seq).accept(response);
          break;
        }
      default:
        return false;
    }
    return true;
  }

  public boolean handleMessage(String message) {
    try {
      JSONObject messageJSON = new JSONObject(message);
      // private String type;
      String type = messageJSON.optString("type");
      if (type != null && type.equals("request")) {
        return handleRequest(messageJSON);
      } else if (type != null && type.equals("response")) {
        return handleResponse(messageJSON);
      }

    } catch (Exception ex) {
      return false;
    }
    return true;
  }

  public boolean handleRequest(JSONObject request) {
    try {
      String command = request.getString("command");
      // uncomment the following line for easier debugging
      // Utils.logVerbose("COMMAND: " + command + ", REQUEST: " + requestJSON.toString(2));
      if (!dispatchRequest(command, request)) {
        Utils.logException("Request: " + request.toString(2), new Throwable());
        Utils.logError(
            "If you see this, please file a bug using the bugnub (bottom left in Nuclide).");
      }
      return true;
    } catch (Exception ex) {
      Utils.logException("Request: " + request.toString(2), ex);
      Utils.logError(
          "If you see this, please file a bug using the bugnub (bottom left in Nuclide).");
    }
    return true;
  }

  public boolean handleResponse(JSONObject request) {
    try {
      String command = request.getString("command");
      if (!dispatchResponse(command, request)) {
        Utils.logException("Request: " + request.toString(2), new Throwable());
        Utils.logError(
            "If you see this, please file a bug using the bugnub (bottom left in Nuclide).");
      }
      return true;
    } catch (Exception ex) {
      Utils.logException("Request: " + request.toString(2), ex);
      Utils.logError(
          "If you see this, please file a bug using the bugnub (bottom left in Nuclide).");
    }
    return true;
  }

  public void receivedEvent(JSONObject eventJSON) {
    Utils.logException("Received Event: " + eventJSON.toString(2), new Throwable());
    Utils.logError("If you see this, please file a bug using the bugnub (bottom left in Nuclide).");
  }

  public void sendBreakpointEvent(
      BreakpointSpec breakpointSpec, boolean verified, Utils.BreakpointEventReasons reason) {
    Breakpoint breakpoint = breakpointSpecToBreakpoint(breakpointSpec, verified);
    send(new BreakpointEvent().setReason(reason.getValue()).setBreakpoint(breakpoint));
  }

  public void sendDebuggerPausedNotification(ThreadReference focusedThread) {
    sendStoppedEventForThread(focusedThread, "breakpoint", true);
    getContextManager()
        .getVirtualMachine()
        .allThreads()
        .parallelStream()
        // filter for the threads that are actually paused
        .filter(thread -> thread.status() == ThreadReference.THREAD_STATUS_WAIT)
        // filter out 'Signal Catcher' threads, we can't get stack trace information on these
        //   threads. They have something to do with ANRs I think...
        .filter(thread -> !thread.name().equals("Signal Catcher"))
        // exclude the one we have already sent
        .filter(thread -> thread.uniqueID() != focusedThread.uniqueID())
        .forEach(thread -> this.sendStoppedEventForThread(thread, "paused", false));
  }

  private void sendStoppedEventForThread(
      ThreadReference thread, String reason, boolean focusedThread) {
    send(
        new StoppedEvent()
            .setReason(reason)
            .setThreadId(thread.uniqueID())
            .setAllThreadsStopped(false)
            .setPreserveFocusHint(!focusedThread));
  }

  public void sendThreadStartEvent(ThreadReference thread) {
    sendThreadEvent(thread, "started");
  }

  public void sendThreadDeathEvent(ThreadReference thread) {
    sendThreadEvent(thread, "exited");
  }

  private void sendThreadEvent(ThreadReference thread, String reason) {
    send(new ThreadEvent().setReason(reason).setThreadId(thread.uniqueID()));
  }

  public void sendExitedEvent() {
    send(new ExitedEvent().setExitCode(0));
  }

  public void sendTerminatedEvent() {
    send(new TerminatedEvent().setRestart(false));
  }

  public void sendUserMessage(String message, Utils.UserMessageLevel level) {
    String category = Utils.userMessageLevelToOutputEventCategory(level);
    send(new OutputEvent().setCategory(category).setOutput(message + "\n"));
  }

  public void sendTelemetryEvent(String eventName, JSONObject values) {
    send(new OutputEvent().setCategory("nuclide_track").setOutput(eventName).setData(values));
  }

  public void sendContinuedEvent(long threadId) {
    send(new ContinuedEvent().setThreadId(threadId).setAllThreadsContinued(true));
  }

  private HashMap<Integer, Integer> getFrameIdToStackFrameIndexMap() {
    return getContextManager().getRemoteObjectManager().frameIdToStackFrameIndex;
  }

  private HashMap<Integer, ThreadReference> getFrameIdToThreadMap() {
    return getContextManager().getRemoteObjectManager().frameIdToThread;
  }

  private com.sun.jdi.StackFrame getStackFrameForFrameId(Integer frameId)
      throws IncompatibleThreadStateException, IndexOutOfBoundsException {
    ThreadReference thread = getFrameIdToThreadMap().get(frameId);
    Integer stackFrameIndex = getFrameIdToStackFrameIndexMap().get(frameId);
    return thread.frame(stackFrameIndex);
  }

  private HashMap<Integer, Integer> getScopeIdToFrameIdMap() {
    return getContextManager().getRemoteObjectManager().scopeIdToFrameId;
  }
}
