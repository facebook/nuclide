# Copyright (c) 2015-present, Facebook, Inc.
# All rights reserved.
#
# This source code is licensed under the license found in the LICENSE file in
# the root directory of this source tree.

"""
Defines methods for the Runtime domain.
https://developer.chrome.com/devtools/docs/protocol/1.1/runtime#command-evaluate
"""
from find_lldb import get_lldb
import sys

from handler import HandlerDomain, handler
from page_domain import DUMMY_FRAME_ID
import value_serializer


class RuntimeDomain(HandlerDomain):
    def __init__(self, **kwargs):
        HandlerDomain.__init__(self, **kwargs)

    @property
    def name(self):
        return 'Runtime'

    @handler()
    def enable(self, params):
        self._notifyExecutionContext()
        return {}

    @handler()
    def evaluate(self, params):
        # Cast to string from possible unicode.
        expression = str(params['expression'])

        # `objectGroups` are used by the client to designate remote objects on
        # the server that should stick around (for potential future queries),
        # and eventually released with a `releaseObjectGroup` call.
        #
        # Incidentally, they have names denoting which part of the client made
        # the request. We use these names to disambiguate LLDB commands from
        # C-style expressions.
        if params['objectGroup'] == 'console':
            result = get_lldb().SBCommandReturnObject()
            self.debugger_store.debugger.GetCommandInterpreter().HandleCommand(expression, result)
            # Swig sometimes creates a malformed inner object of SBCommandReturnObject that, when
            # trying to resolve .GetError(), crashes.
            # TODO(wallace): Check when this bug is fixed on lldb upstream.
            try:
                value = result.GetOutput() + result.GetError()
            except:
                value = result.GetOutput()
            return {
                'result': {
                    'value': value,
                    'type': 'text',
                },
                'wasThrown': False,
            }
        elif params['objectGroup'] == 'watch-group':
            frame = self.debugger_store.debugger.GetSelectedTarget(). \
                process.GetSelectedThread().GetSelectedFrame()
            # TODO: investigate why "EvaluateExpression"
            # is not working for some scenarios on Linux.
            if sys.platform.startswith('linux'):
                value = frame.GetValueForVariablePath(expression)
            else:
                value = frame.EvaluateExpression(expression)
            # `value.error` is an `SBError` instance which captures whether the
            # result had an error. `SBError.success` denotes no error.
            if value.error.success:
                return {
                    'result': value_serializer.serialize_value(
                        value,
                        self.debugger_store.remote_object_manager.
                        get_add_object_func(params['objectGroup'])),
                    'wasThrown': False,
                }
            else:
                return {
                    'result': {
                        'type': 'text',
                    },
                    'wasThrown': True,
                    'exceptionDetails': {
                        'text': value.error.description,
                    }
                }
        return {
            'result': {},
            'wasThrown': False,
        }

    @handler()
    def getProperties(self, params):
        """Returns properties of a given object.

        Object group of the result is inherited from the target object.

        Params:
            objectId RemoteObjectId
                Identifier of the object to return properties for.
            ownProperties boolean
                If true, returns properties belonging only to the element
                itself, not to its prototype chain.
            accessorPropertiesOnly boolean
                If true, returns accessor properties (with getter/setter) only;
                internal properties are not returned either.
            generatePreview	boolean
                Whether preview should be generated for the results.
        """
        obj = self.debugger_store.remote_object_manager.get_object(params['objectId'])
        if obj and not params.get('accessorPropertiesOnly', False):
            return obj.properties
        else:
            return {'result': []}

    def _notifyExecutionContext(self):
        # Send a notification context with frame id of the dummy frame sent by
        # Page.getResourceTree.
        selectedTarget = self.debugger_store.debugger.GetSelectedTarget()
        if selectedTarget.IsValid():
            filename = self.debugger_store.debugger.GetSelectedTarget().executable.basename
            pid = self.debugger_store.debugger.GetSelectedTarget().process.id
            name = 'LLDB - %s (%d)' % (filename, pid)
        else:
            name = 'LLDB - no target'
        self.debugger_store.chrome_channel.send_notification(
            'Runtime.executionContextCreated',
            params={
                'context': {
                    'id': 1,
                    'frameId': DUMMY_FRAME_ID,
                    'name': name,
                },
            })
