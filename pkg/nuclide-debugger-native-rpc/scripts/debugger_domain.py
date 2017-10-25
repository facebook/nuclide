# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import os
import sys
import urlparse
from find_lldb import get_lldb
from handler import HandlerDomain, UndefinedHandlerError, handler
from logging_helper import log_debug
import file_manager
import re

class DebuggerDomain(HandlerDomain):
    '''Implement Chrome debugger domain protocol and
    convert into lldb python API.
    '''
    def __init__(self, runtimeDomain, **kwargs):
        HandlerDomain.__init__(self, **kwargs)
        self.runtimeDomain = runtimeDomain
        self.exceptionBreakpointId = None

    @property
    def name(self):
        return 'Debugger'

    @handler()
    def canSetScriptSource(self, params):
        # Return False, because we don't support
        # changing source at runtime.
        return {"result": False}

    @handler()
    def continueToLocation(self, params):
        client_url = params['location']['scriptId']
        if not client_url.startswith('file://'):
            client_url = 'file://' + client_url
        filelike = self.debugger_store.file_manager.get_by_client_url(client_url)
        if not filelike or not isinstance(filelike, file_manager.File):
            # Only support setting breakpoints in real files.
            return {}

        lldb = get_lldb()
        path = str(params['location']['scriptId'])
        thread = self.debugger_store.debugger.GetSelectedTarget().GetProcess().GetSelectedThread()
        frame = thread.GetSelectedFrame()
        # atom line numbers a 0-based, while lldb is 1-based
        line = int(params['location']['lineNumber']) + 1
        thread.StepOverUntil(frame, filelike.server_obj, line)
        return {}

    @handler()
    def disable(self, params):
        # Not exactly the same as disable. Detach() might be closer to
        # what Chrome Dev Tools is trying to do.
        self.debugger_store.debugger.GetSelectedTarget().DisableAllBreakpoints()
        return {}

    @handler()
    def enable(self, params):
        formatter_path = os.path.join(os.path.dirname(__file__), 'data_formatter.py')
        self.debugger_store.debugger.HandleCommand('command script import %s' % formatter_path)
        self.debugger_store.chrome_channel.enable()
        return {}

    @handler()
    def evaluateOnCallFrame(self, params):
        frameId = params['callFrameId']

        thread, frame = frameId.split('.')
        # TODO: These return booleans to indicate success. Throw something if False.
        process = self.debugger_store.debugger.GetSelectedTarget().process
        process.SetSelectedThreadByIndexID(int(thread))
        process.GetSelectedThread().SetSelectedFrame(int(frame))

        return self.runtimeDomain.evaluate(params)

    @handler()
    def pause(self, params):
        self.debugger_store.debugger.GetSelectedTarget().process.Stop()
        return {}

    @handler()
    def removeBreakpoint(self, params):
        self.debugger_store.debugger.GetSelectedTarget().BreakpointDelete(int(params['breakpointId']))
        return {}

    @handler()
    def resume(self, params):
        self.debugger_store.debugger.GetSelectedTarget().process.Continue()
        return {}

    @handler()
    def selectThread(self, params):
        threadId = params['threadId']
        self.debugger_store.debugger.GetSelectedTarget().process.SetSelectedThreadByID(threadId)
        return {}

    @handler()
    def getThreadStack(self, params):
        threadId = params['threadId']
        thread = self.debugger_store.debugger.GetSelectedTarget().process.GetThreadByID(threadId)
        params = { "callFrames": [] }
        if not thread == None:
            params["callFrames"] = self.debugger_store.thread_manager.get_thread_stack(thread)
        return params

    @handler()
    def searchInContent(self, params):
        raise UndefinedHandlerError('searchInContent not implemented')

    @handler()
    def setBreakpoint(self, params):
        if self._is_hex_address(params['location']['scriptId']):
            # This breakpoint is at a memory address location, not a file.
            return self._set_breakpoint_by_address(params['location']['scriptId'])

        # Otherwise it's a regular file+line breakpoint
        filelike = self.debugger_store.file_manager.get_by_script_id(params['location']['scriptId'])
        if not filelike or not isinstance(filelike, file_manager.File):
            # Only support setting breakpoints in real files.
            return {}
        return self._set_breakpoint_by_filespec(
            filelike.server_obj,
            int(params['location']['lineNumber']) + 1)

    @handler()
    def setBreakpointByUrl(self, params):
        # If the url contains a hex address rather than a file path,
        # treat this as an address breakpoint.
        possible_address = params['url'].replace('file://', '')
        if self._is_hex_address(possible_address):
            # This breakpoint is at a memory address location, not a file.
            return self._set_breakpoint_by_address(possible_address)

        # Otherwise, it's a regular file+line breakpoint
        # Use source file name to set breakpoint.
        parsed_url = urlparse.urlparse(params['url'])

        return self._set_breakpoint_by_source_path(
            str(os.path.basename(parsed_url.path)),
            int(params['lineNumber']) + 1,
            str(params['condition']))

    @handler()
    def setBreakpointsActive(self, params):
        if params['active']:
            self.debugger_store.debugger.GetSelectedTarget().EnableAllBreakpoints()
        else:
            self.debugger_store.debugger.GetSelectedTarget().DisableAllBreakpoints()
        return {}

    @handler()
    def setPauseOnExceptions(self, params):
        # First, unhook the old breakpoint exceptions.
        if self.exceptionBreakpointId is not None:
            self.debugger_store.debugger.GetSelectedTarget().BreakpointDelete(
                                                    self.exceptionBreakpointId)
            self.exceptionBreakpointId = None
        # Next, we've been asked to do one of 'none' or 'uncaught' or 'all'.
        # But we'll treat none+uncaught as no-op since that's all LLDB can do.
        if params['state'] == 'all':
            breakpoint = self.debugger_store.debugger.GetSelectedTarget(
                    ).BreakpointCreateForException(get_lldb().eLanguageTypeC_plus_plus,
                                                   False,  # don't pause on catch
                                                   True    # do pause on throw
                                                   )
            self.exceptionBreakpointId = breakpoint.id
        return {}

    @handler()
    def setScriptSource(self, params):
        raise UndefinedHandlerError('setScriptSource not supported for LLDB')

    @handler()
    def stepInto(self, params):
        thread = self.debugger_store.debugger.GetSelectedTarget().GetProcess().GetSelectedThread()
        flag = self._getSteppingFlag()
        thread.StepInto(flag)
        return {}

    @handler()
    def stepOut(self, params):
        self.debugger_store.debugger.GetSelectedTarget().GetProcess().GetSelectedThread().StepOut()
        return {}

    @handler()
    def stepOver(self, params):
        thread = self.debugger_store.debugger.GetSelectedTarget().GetProcess().GetSelectedThread()
        flag = self._getSteppingFlag()
        thread.StepOver(flag)
        return {}

    @handler()
    def setDebuggerSettings(self, params):
        self.debugger_store.setDebuggerSettings(params)
        return {}

    def _set_breakpoint_by_filespec(self, filespec, line):
        breakpoint = self.debugger_store.debugger.GetSelectedTarget().BreakpointCreateByLocation(filespec, line)
        return {
            'breakpointId': str(breakpoint.id),
            'locations':
                self.debugger_store.location_serializer.get_breakpoint_locations(breakpoint),
        }

    def _set_breakpoint_by_address(self, address):
        target = self.debugger_store.debugger.GetSelectedTarget()
        breakpoint = target.BreakpointCreateByAddress(int(address, 16))
        locations = self.debugger_store.location_serializer.get_breakpoint_locations(breakpoint)
        return {
            'breakpointId': str(breakpoint.id),
            'locations': locations,
        }

    def _getSteppingFlag(self):
        lldb = get_lldb()
        if self.debugger_store.getDebuggerSettings()['singleThreadStepping']:
            return lldb.eOnlyThisThread
        return lldb.eOnlyDuringStepping

    def _set_breakpoint_by_source_path(self, source_path, line, condition):
        breakpoint = self.debugger_store.debugger.GetSelectedTarget().BreakpointCreateByLocation(
            source_path,
            line)
        if condition:  # empty string is falsy.
            breakpoint.SetCondition(condition)
        return {
            'breakpointId': str(breakpoint.id),
            'locations': self.debugger_store.location_serializer.get_breakpoint_locations(breakpoint),
        }

    def _is_hex_address(self, path):
        pattern = re.compile('0x[0-9A-Fa-f]+')
        return re.match(pattern, path)
