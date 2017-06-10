/*
 * Copyright (C) 2010 Google Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.DebuggerModel.ThreadStore = function(debuggerModel)
{
     /** @type {!Object.<number, !WebInspector.DebuggerModel.Thread>} */
     this._threadMap = new Map();
     this._owningProcessId = 0;
     this._stopThreadId = 0;
     this._selectedThreadId = 0;
     this._debuggerModel = debuggerModel;
}

WebInspector.DebuggerModel.ThreadStore.prototype = {

    update: function(eventData)
    {
        // Clear previous threads.
        this._threadMap.clear();
        this._owningProcessId = eventData.owningProcessId;
        this._stopThreadId = eventData.stopThreadId;
        this._selectedThreadId = eventData.stopThreadId;
        for (var i = 0; i < eventData.threads.length; ++ i) {
            this._threadMap.set(
                eventData.threads[i].id,
                new WebInspector.DebuggerModel.Thread(this._debuggerModel, eventData.threads[i])
            );
        }

        this._debuggerModel.dispatchEventToListeners(
            WebInspector.DebuggerModel.Events.ThreadsUpdated,
            this
        );
    },

    selectThread: function(threadId)
    {
        this._selectedThreadId = threadId;
        this._debuggerModel.dispatchEventToListeners(
            WebInspector.DebuggerModel.Events.SelectedThreadChanged,
            this
        );
    },

    getActiveThreadStack: function(callback)
    {
        this._fetchThreadStackIfNeeded(this._selectedThreadId, callback);
    },

    getRefreshedThreadStack: function(callback)
    {
        this._fetchThreadStackIfNeeded(this._selectedThreadId, callback, true);
    },

    _fetchThreadStackIfNeeded: function(threadId, callback, forceRefresh)
    {
        var thread = this._threadMap.get(threadId);
        if (forceRefresh || (thread && !thread.isCallstackFetched))
        {
            function onThreadStackFetched(error, callFrames)
            {
                var parsedFrames = WebInspector.DebuggerModel.CallFrame.fromPayloadArray(this._debuggerModel.target(), callFrames);
                if (error) {
                    callback(error);
                    return;
                }

                if (thread != null) {
                  thread.stackFrames = parsedFrames;
                }

                callback(parsedFrames);

                if (thread != null) {
                  thread.isCallstackFetched = true;
                }
            }
            this._debuggerModel.getThreadStack(Number(threadId), onThreadStackFetched.bind(this));
        } else {
            callback(thread != null ? thread.stackFrames : []);
        }
    },

    _getThreadStack: function(threadId)
    {
        var stackFrames = [];
        var thread = this._threadMap.get(threadId);
        if (thread)
        {
            stackFrames = thread.stackFrames;
        }
        return stackFrames;
    },

    getData: function()
    {
        return {
            'owningProcessId': this._owningProcessId,
            'stopThreadId': this._stopThreadId,
            'selectedThreadId': this._selectedThreadId,
            'threadMap': this._threadMap,
        };
    },
}

 /**
  * @constructor
  * @extends {WebInspector.SDKObject}
  * @param {!DebuggerAgent.Thread} payload
  */
 WebInspector.DebuggerModel.Thread = function(debuggerModel, payload)
 {
     WebInspector.SDKObject.call(this, debuggerModel.target());

     this._debuggerAgent = debuggerModel._agent;
     this._id = payload.id;
     this._name = payload.name;
     this._address = payload.address;
     this._location = WebInspector.DebuggerModel.Location.fromPayload(debuggerModel.target(), payload.location);
     this._stop_reason = payload.stopReason;
     this._description = payload.description;
     this._isCallstackFetched = false;
     this._stackFrames = [];
 }

 WebInspector.DebuggerModel.Thread.prototype = {
    /**
    * @return {string}
    */
    get id()
    {
        return this._id;
    },

    /**
    * @return {string}
    */
    get name()
    {
        return this._name;
    },

    /**
    * @return {string}
    */
    get address()
    {
        return this._address;
    },

    /**
    * @return {!WebInspector.DebuggerModel.Location}
    */
    get location()
    {
        return this._location;
    },

    /**
    * @return {string}
    */
    get stopReason()
    {
        return this._stop_reason;
    },

    /**
    * @return {string}
    */
    get description()
    {
        return this._description;
    },


    get isCallstackFetched()
    {
        return this._isCallstackFetched
    },

    set isCallstackFetched(value)
    {
        this._isCallstackFetched = value;
    },

    get stackFrames()
    {
        return this._stackFrames;
    },

    set stackFrames(stackFrames)
    {
        this._stackFrames = stackFrames;
    },

    suspend: function()
    {
        // TODO.
    },

    resume: function()
    {
        // TODO.
    },

    __proto__: WebInspector.SDKObject.prototype
 }
