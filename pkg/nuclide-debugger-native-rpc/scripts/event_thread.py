# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

import sys
import serialize
from find_lldb import get_lldb
from threading import Thread
from logging_helper import log_debug, log_error


class LLDBListenerThread(Thread):
    '''Implement lldb event pumping and process state update.
    The process state updates are converted into Chrome debugger notification to update UI.
    '''
    should_quit = False

    def __init__(self, debugger_store, app):
        Thread.__init__(self)
        self.daemon = True
        self._debugger_store = debugger_store
        self._app = app
        self._listener = debugger_store.debugger.GetListener()
        lldb = get_lldb()
        self.breakpoint_event_type_to_name_map = {
            lldb.eBreakpointEventTypeAdded: 'Added',
            lldb.eBreakpointEventTypeCommandChanged: 'Command Changed',
            lldb.eBreakpointEventTypeConditionChanged: 'Condition Changed',
            lldb.eBreakpointEventTypeDisabled: 'Disabled',
            lldb.eBreakpointEventTypeEnabled: 'Enabled',
            lldb.eBreakpointEventTypeIgnoreChanged: 'Ignore Changed',
            lldb.eBreakpointEventTypeInvalidType: 'Invalid Type',
            lldb.eBreakpointEventTypeLocationsAdded: 'Location Added',
            lldb.eBreakpointEventTypeLocationsRemoved: 'Location Removed',
            lldb.eBreakpointEventTypeLocationsResolved: 'Location Resolved',
            lldb.eBreakpointEventTypeRemoved: 'Removed',
            lldb.eBreakpointEventTypeThreadChanged: 'Thread Changed',
        }

        process = debugger_store.debugger.GetSelectedTarget().process
        self._add_listener_to_process(process)

        # LLDB will not emit any stopping event during attach.
        # Linux lldb has a bug of not emitting stopping event during launch.
        if self._debugger_store.is_attach or sys.platform.startswith('linux'):
            if process.state != lldb.eStateStopped:
                # Instead of using assert() which will crash debugger log an error message
                # and tolerate this non-fatal situation.
                log_error('Inferior should be stopped after attach or linux launch')
            self._send_paused_notification(process)
        self._add_listener_to_target(process.target)

    def _add_listener_to_target(self, target):
        # Listen for breakpoint/watchpoint events (Added/Removed/Disabled/etc).
        broadcaster = target.GetBroadcaster()
        lldb = get_lldb()
        mask = lldb.SBTarget.eBroadcastBitBreakpointChanged | \
            lldb.SBTarget.eBroadcastBitWatchpointChanged | \
            lldb.SBTarget.eBroadcastBitModulesLoaded | \
            lldb.SBTarget.eBroadcastBitModulesUnloaded | \
            lldb.SBTarget.eBroadcastBitSymbolsLoaded
        broadcaster.AddListener(self._listener, mask)

    def _add_listener_to_process(self, process):
        # Listen for process events (Start/Stop/Interrupt/etc).
        broadcaster = process.GetBroadcaster()
        lldb = get_lldb()
        mask = lldb.SBProcess.eBroadcastBitStateChanged | \
            lldb.SBProcess.eBroadcastBitSTDOUT | \
            lldb.SBProcess.eBroadcastBitSTDERR | \
            lldb.SBProcess.eBroadcastBitInterrupt
        broadcaster.AddListener(self._listener, mask)

    def _handle_target_event(self, event):
        lldb = get_lldb()
        if event.GetType() == lldb.SBTarget.eBroadcastBitModulesLoaded:
            self._handle_module_load_event(event)
        elif event.GetType() == lldb.SBTarget.eBroadcastBitModulesUnloaded:
            self._handle_module_unload_event(event)
        elif event.GetType() == lldb.SBTarget.eBroadcastBitSymbolsLoaded:
            self._send_user_output('log', 'Symbol loaded')
        else:
            self.self._handle_unknown_event(event)

    def _handle_module_load_event(self, event):
        self._send_module_event_notification(event, is_load=True)

    def _handle_module_unload_event(self, event):
        self._send_module_event_notification(event, is_load=False)

    def _send_module_event_notification(self, event, is_load):
        lldb = get_lldb()
        module_count = lldb.SBTarget.GetNumModulesFromEvent(event)
        for i in range(module_count):
            module = lldb.SBTarget.GetModuleAtIndexFromEvent(i, event)
            module_file_name = module.GetPlatformFileSpec().GetFilename()
            output = 'Module(%s) %s' % (module_file_name, 'load' if is_load else 'unload')
            self._send_user_output('log', output)

    def _send_user_output(self, level, text):
        self._debugger_store.ipc_channel.send_output_message_async(level, text)

    def _handle_process_event(self, event):
        lldb = get_lldb()
        # Ignore non-stopping events.
        if lldb.SBProcess.GetRestartedFromEvent(event):
            log_debug('Non stopping event: %s' % str(event))
            return

        # Reset the object group so old frame variable objects don't linger
        # forever.
        self._debugger_store.thread_manager.release()

        process = lldb.SBProcess.GetProcessFromEvent(event)
        if process.state == lldb.eStateStopped:
            self._send_paused_notification(process)
        elif process.state == lldb.eStateExited:
            exit_message = 'Process(%d) exited with: %u' % (
                    process.GetProcessID(),
                    process.GetExitStatus())
            if process.GetExitDescription():
                exit_message += (', ' + process.GetExitDescription())
            self._send_user_output('log', exit_message)
            self.should_quit = True
        else:
            self._send_notification('Debugger.resumed', None)

        event_type = event.GetType()
        if event_type == lldb.SBProcess.eBroadcastBitSTDOUT:
            # Read stdout from inferior.
            process_output = ''
            while True:
                output_part = process.GetSTDOUT(1024)
                if not output_part or len(output_part) == 0:
                    break
                process_output += output_part
            self._send_user_output('log', process_output)

    def _send_paused_notification(self, process):
        self._update_stop_thread(process)
        self._debugger_store.thread_manager.update_thread_switch_message(process)
        thread = process.GetSelectedThread()
        output = 'Debugger paused at thread(%d) because of: %s' % (
            thread.GetThreadID(),
            self._debugger_store.thread_manager.get_thread_stop_description(thread))
        self._send_user_output('log', output)
        break_num = thread.GetStopReasonDataAtIndex(0)
        selected_target = self._debugger_store.debugger.GetSelectedTarget()
        breakpoint = selected_target.FindBreakpointByID(break_num)
        params = {
            'breakpointId': str(break_num),
            'hitCount': str(breakpoint.GetHitCount()),
        }
        self._send_notification('Debugger.breakpointHitCountChanged', params)
        threadSwitchMessage = self._debugger_store.thread_manager.get_thread_switch_message()
        if threadSwitchMessage:
            self._send_user_output('info', threadSwitchMessage)
            params = {
              "callFrames": self._debugger_store.thread_manager.get_thread_stack(thread),
              "reason": serialize.StopReason_to_string(thread.GetStopReason()),
              "threadSwitchMessage": threadSwitchMessage,
              "data": {},
              }
        else:
            params = {
              "callFrames": self._debugger_store.thread_manager.get_thread_stack(thread),
              "reason": serialize.StopReason_to_string(thread.GetStopReason()),
              "data": {},
              }
        self._send_notification('Debugger.paused', params)
        self._debugger_store.thread_manager.send_threads_updated(process)

    def _update_stop_thread(self, process):
        '''lldb on Linux has a bug of not setting stop thread correctly.
        This method fixes this issue.
        TODO: remove this when lldb fixes this on Linux.
        '''
        thread = process.GetSelectedThread()
        lldb = get_lldb()
        if thread.GetStopReason() != lldb.eStopReasonNone:
            return
        for thread in process.threads:
            if thread.GetStopReason() != lldb.eStopReasonNone:
                process.SetSelectedThread(thread)
                return

    def _handle_breakpoint_event(self, event):
        lldb = get_lldb()
        breakpoint = lldb.SBBreakpoint.GetBreakpointFromEvent(event)
        event_type = lldb.SBBreakpoint.GetBreakpointEventTypeFromEvent(event)
        log_debug('Breakpoint event: [%s] %s ' % (
            self.breakpoint_event_type_to_name_map[event_type],
            self._get_description_from_object(breakpoint)))
        if event_type == lldb.eBreakpointEventTypeLocationsResolved:
            for location in \
                    self._debugger_store.location_serializer.get_breakpoint_locations(breakpoint):
                params = {
                    'breakpointId': str(breakpoint.id),
                    'location': location,
                }
                self._send_notification('Debugger.breakpointResolved', params)
        else:
            # TODO: handle other breakpoint event types.
            pass

    def _get_description_from_object(self, lldb_object):
        description_stream = get_lldb().SBStream()
        lldb_object.GetDescription(description_stream)
        return description_stream.GetData()

    def _send_notification(self, method, params):
        self._debugger_store.chrome_channel.send_notification(method, params)

    def _handle_watchpoint_event(self, event):
        # TODO(williamsc) Add support for sending watchpoint change events.
        pass

    def _handle_unknown_event(self, event):
        log_error('Unknown event: %d %s %s' % (
            event.GetType(),
            get_lldb().SBEvent.GetCStringFromEvent(event),
            self._get_description_from_object(event)))

    def run(self):
        lldb = get_lldb()
        while not self.should_quit:
            event = lldb.SBEvent()
            if self._listener.WaitForEvent(1, event):
                if lldb.SBTarget.EventIsTargetEvent(event):
                    self._handle_target_event(event)
                elif lldb.SBProcess.EventIsProcessEvent(event):
                    self._handle_process_event(event)
                # Even though Breakpoints are registered on SBTarget
                # lldb.SBTarget.EventIsTargetEvent()
                # will return false for breakpoint events so handle them here.
                elif lldb.SBBreakpoint.EventIsBreakpointEvent(event):
                    self._handle_breakpoint_event(event)
                elif lldb.SBWatchpoint.EventIsWatchpointEvent(event):
                    self._handle_watchpoint_event(event)
                else:
                    self._handle_unknown_event(event)

        # Event loop terminates, shutdown chrome server app.
        self._app.shutdown()
        # Detach/Kill inferior.
        if self._debugger_store.is_attach:
            self._debugger_store.debugger.GetSelectedTarget().process.Detach()
        else:
            self._debugger_store.debugger.GetSelectedTarget().process.Kill()
