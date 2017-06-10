/*
 * Copyright (C) 2011 Google Inc. All rights reserved.
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
 *
 * @noflow
 */

/* eslint-disable */

var DebuggerDomainDispatcher = require('./DebuggerDomainDispatcher');
var RuntimeDomainDispatcher = require('./RuntimeDomainDispatcher');

/**
 * @constructor
 */
function InspectorBackendClass()
{
    this._connection = null;
    this._agentPrototypes = {};
    this._dispatcherPrototypes = {};
    this._initialized = false;
    this._enums = {};
    this._initProtocolAgentsConstructor();
}

InspectorBackendClass._DevToolsErrorCode = -32000;

/**
 * @param {string} error
 * @param {!Object} messageObject
 */
InspectorBackendClass.reportProtocolError = function(error, messageObject)
{
    console.error(error + ": " + JSON.stringify(messageObject));
}

InspectorBackendClass.prototype = {

    _initProtocolAgentsConstructor: function()
    {
        window.Protocol = {};

        /**
         * @constructor
         * @param {!Object.<string, !Object>} agentsMap
         */
        window.Protocol.Agents = function(agentsMap) {
            this._agentsMap = agentsMap;
        };
    },

    /**
     * @param {string} domain
     */
    _addAgentGetterMethodToProtocolAgentsPrototype: function(domain)
    {
        var upperCaseLength = 0;
        while (upperCaseLength < domain.length && domain[upperCaseLength].toLowerCase() !== domain[upperCaseLength])
            ++upperCaseLength;

        var methodName = domain.substr(0, upperCaseLength).toLowerCase() + domain.slice(upperCaseLength) + "Agent";

        /**
         * @this {Protocol.Agents}
         */
        function agentGetter()
        {
            return this._agentsMap[domain];
        }

        window.Protocol.Agents.prototype[methodName] = agentGetter;

        /**
         * @this {Protocol.Agents}
         */
        function registerDispatcher(dispatcher)
        {
            this.registerDispatcher(domain, dispatcher)
        }

        window.Protocol.Agents.prototype["register" + domain + "Dispatcher"] = registerDispatcher;
    },

    /**
     * @return {!InspectorBackendClass.Connection}
     */
    connection: function()
    {
        if (!this._connection)
            throw "Main connection was not initialized";
        return this._connection;
    },

    /**
     * @param {!InspectorBackendClass.MainConnection} connection
     */
    setConnection: function(connection)
    {
        this._connection = connection;

        this._connection.registerAgentsOn(window);
        for (var type in this._enums) {
            var domainAndMethod = type.split(".");
            window[domainAndMethod[0] + "Agent"][domainAndMethod[1]] = this._enums[type];
        }
    },

    /**
     * @param {string} domain
     * @return {!InspectorBackendClass.AgentPrototype}
     */
    _agentPrototype: function(domain)
    {
        if (!this._agentPrototypes[domain]) {
            this._agentPrototypes[domain] = new InspectorBackendClass.AgentPrototype(domain);
            this._addAgentGetterMethodToProtocolAgentsPrototype(domain);
        }

        return this._agentPrototypes[domain];
    },

    /**
     * @param {string} domain
     * @return {!InspectorBackendClass.DispatcherPrototype}
     */
    _dispatcherPrototype: function(domain)
    {
        if (!this._dispatcherPrototypes[domain])
            this._dispatcherPrototypes[domain] = new InspectorBackendClass.DispatcherPrototype();
        return this._dispatcherPrototypes[domain];
    },

    /**
     * @param {string} method
     * @param {!Array.<!Object>} signature
     * @param {!Array.<string>} replyArgs
     * @param {boolean} hasErrorData
     */
    registerCommand: function(method, signature, replyArgs, hasErrorData)
    {
        var domainAndMethod = method.split(".");
        this._agentPrototype(domainAndMethod[0]).registerCommand(domainAndMethod[1], signature, replyArgs, hasErrorData);
        this._initialized = true;
    },

    /**
     * @param {string} type
     * @param {!Object} values
     */
    registerEnum: function(type, values)
    {
        this._enums[type] = values;
        this._initialized = true;
    },

    /**
     * @param {string} eventName
     * @param {!Object} params
     */
    registerEvent: function(eventName, params)
    {
        var domain = eventName.split(".")[0];
        this._dispatcherPrototype(domain).registerEvent(eventName, params);
        this._initialized = true;
    },

    /**
     * @param {string} jsonUrl
     */
    loadFromJSONIfNeeded: function(jsonUrl, transport)
    {
        if (this._initialized)
            return;

        var parseProtocolPromise = new Promise((resolve, reject) => {
          var fs = require('fs')
          fs.readFile(jsonUrl, 'utf8', function(err, data) {
              if (err) throw err;
              var schema = JSON.parse(data);
              InspectorBackendClass._generateCommands(schema);

              var connection = new InspectorBackendClass.StubConnection(transport);
              InspectorBackend.setConnection(connection);

              var debuggerAgent = connection.agent('Debugger');
              var debuggerDispatcher = new DebuggerDomainDispatcher(debuggerAgent);
              connection.registerDispatcher('Debugger', debuggerDispatcher);
              var runtimeAgent = connection.agent('Runtime');
              var runtimeDispatcher = new RuntimeDomainDispatcher(runtimeAgent);
              connection.registerDispatcher('Runtime', runtimeDispatcher);

              InspectorBackend._initialized = false;
              resolve({debuggerDispatcher, runtimeDispatcher});
          });
        });
        return parseProtocolPromise;
    },

    /**
     * @param {function(T)} clientCallback
     * @param {string} errorPrefix
     * @param {function(new:T,S)=} constructor
     * @param {T=} defaultValue
     * @return {function(?string, S)}
     * @template T,S
     */
    wrapClientCallback: function(clientCallback, errorPrefix, constructor, defaultValue)
    {
        /**
         * @param {?string} error
         * @param {S} value
         * @template S
         */
        function callbackWrapper(error, value)
        {
            if (error) {
                console.error(errorPrefix + error);
                clientCallback(defaultValue);
                return;
            }
            if (constructor)
                clientCallback(new constructor(value));
            else
                clientCallback(value);
        }
        return callbackWrapper;
    }
}

/**
 * @param {*} schema
 * @return {string}
 */
InspectorBackendClass._generateCommands = function(schema) {
    var jsTypes = { integer: "number", array: "object" };
    var rawTypes = {};

    var domains = schema["domains"] || [];
    for (var i = 0; i < domains.length; ++i) {
        var domain = domains[i];
        for (var j = 0; domain.types && j < domain.types.length; ++j) {
            var type = domain.types[j];
            rawTypes[domain.domain + "." + type.id] = jsTypes[type.type] || type.type;
        }
    }

    function toUpperCase(groupIndex, group0, group1)
    {
        return [group0, group1][groupIndex].toUpperCase();
    }
    function generateEnum(enumName, items)
    {
        var members = [];
        for (var m = 0; m < items.length; ++m) {
            var value = items[m];
            var name = toTitleCase(value.replace(/-(\w)/g, toUpperCase.bind(null, 1)));
            name = name.replace(/HTML|XML|WML|API/ig, toUpperCase.bind(null, 0));
            members.push(`${name}: ${value}`);
        }
        InspectorBackend.registerEnum(enumName, members);
    }

    for (var i = 0; i < domains.length; ++i) {
        var domain = domains[i];

        var types = domain["types"] || [];
        for (var j = 0; j < types.length; ++j) {
            var type = types[j];
            if ((type["type"] === "string") && type["enum"])
                generateEnum(domain.domain + "." + type.id, type["enum"]);
            else if (type["type"] === "object") {
                var properties = type["properties"] || [];
                for (var k = 0; k < properties.length; ++k) {
                    var property = properties[k];
                    if ((property["type"] === "string") && property["enum"])
                        generateEnum(domain.domain + "." + type.id + toTitleCase(property["name"]), property["enum"]);
                }
            }
        }

        var commands = domain["commands"] || [];
        for (var j = 0; j < commands.length; ++j) {
            var command = commands[j];
            var parameters = command["parameters"];
            var params = [];
            for (var k = 0; parameters && k < parameters.length; ++k) {
                var parameter = parameters[k];

                var type;
                if (parameter.type)
                    type = jsTypes[parameter.type] || parameter.type;
                else {
                    var ref = parameter["$ref"];
                    if (ref.indexOf(".") !== -1)
                        type = rawTypes[ref];
                    else
                        type = rawTypes[domain.domain + "." + ref];
                }

                params.push({
                  name: parameter.name,
                  type: type,
                  optional: parameter.optional
                });
            }

            var returnsText = [];
            var returns = command["returns"] || [];
            for (var k = 0; k < returns.length; ++k) {
                var parameter = returns[k];
                returnsText.push(parameter.name);
            }
            var hasErrorData = command.error;
            InspectorBackend.registerCommand(domain.domain + "." + command.name, params, returnsText, hasErrorData);
        }

        for (var j = 0; domain.events && j < domain.events.length; ++j) {
            var event = domain.events[j];
            var paramsText = [];
            for (var k = 0; event.parameters && k < event.parameters.length; ++k) {
                var parameter = event.parameters[k];
                paramsText.push(parameter.name);
            }
            InspectorBackend.registerEvent(domain.domain + "." + event.name , paramsText);
        }
    }
}

/**
 *  @constructor
 *  @extends {WebInspector.Object}
 */
InspectorBackendClass.Connection = function()
{
    // Change to a big range to not collide with
    // chrome channel range.
    this._lastMessageId = 50000;
    this._pendingResponsesCount = 0;
    this._agents = {};
    this._dispatchers = {};
    this._callbacks = {};
    this._initialize(InspectorBackend._agentPrototypes, InspectorBackend._dispatcherPrototypes);
    this._isConnected = true;
}

InspectorBackendClass.Connection.Events = {
    Disconnected: "Disconnected",
}

InspectorBackendClass.Connection.prototype = {

    /**
     * @param {!Object.<string, !InspectorBackendClass.AgentPrototype>} agentPrototypes
     * @param {!Object.<string, !InspectorBackendClass.DispatcherPrototype>} dispatcherPrototypes
     */
    _initialize: function(agentPrototypes, dispatcherPrototypes)
    {
        for (var domain in agentPrototypes) {
            this._agents[domain] = Object.create(agentPrototypes[domain]);
            this._agents[domain].setConnection(this);
        }

        for (var domain in dispatcherPrototypes)
            this._dispatchers[domain] = Object.create(dispatcherPrototypes[domain]);

    },

    /**
     * @param {!Object} object
     */
    registerAgentsOn: function(object)
    {
        for (var domain in this._agents)
            object[domain + "Agent"]  = {};
    },

    /**
     * @return {number}
     */
    nextMessageId: function()
    {
        return this._lastMessageId++;
    },

    /**
     * @param {string} domain
     * @return {!InspectorBackendClass.AgentPrototype}
     */
    agent: function(domain)
    {
        return this._agents[domain];
    },

    /**
     * @return {!Object.<string, !Object>}
     */
    agentsMap: function()
    {
        return this._agents;
    },

    /**
     * @param {string} domain
     * @param {string} method
     * @param {?Object} params
     * @param {?function(*)} callback
     */
    _wrapCallbackAndSendMessageObject: function(domain, method, params, callback)
    {
        if (!this._isConnected && callback) {
            this._dispatchConnectionErrorResponse(domain, method, callback);
            return;
        }

        var messageObject = {};

        var messageId = this.nextMessageId();
        messageObject.id = messageId;

        messageObject.method = method;
        if (params)
            messageObject.params = params;

        var wrappedCallback = this._wrap(callback, domain, method);

        if (InspectorBackendClass.Options.dumpInspectorProtocolMessages)
            this._dumpProtocolMessage("frontend: " + JSON.stringify(messageObject));

        this.sendMessage(messageObject);
        ++this._pendingResponsesCount;
        this._callbacks[messageId] = wrappedCallback;
    },

    /**
     * @param {?function(*)} callback
     * @param {string} method
     * @param {string} domain
     * @return {function(*)}
     */
    _wrap: function(callback, domain, method)
    {
        if (!callback)
            callback = function() {};

        callback.methodName = method;
        callback.domain = domain;
        if (InspectorBackendClass.Options.dumpInspectorTimeStats)
            callback.sendRequestTime = Date.now();

        return callback;
    },

    /**
     * @param {!Object} messageObject
     */
    sendMessage: function(messageObject)
    {
        throw "Not implemented";
    },

    /**
     * @param {!Object|string} message
     */
    dispatch: function(message)
    {
        if (InspectorBackendClass.Options.dumpInspectorProtocolMessages)
            this._dumpProtocolMessage("backend: " + ((typeof message === "string") ? message : JSON.stringify(message)));

        var messageObject = /** @type {!Object} */ ((typeof message === "string") ? JSON.parse(message) : message);

        if ("id" in messageObject) { // just a response for some request
            var callback = this._callbacks[messageObject.id];
            if (!callback) {
                InspectorBackendClass.reportProtocolError("Protocol Error: the message with wrong id", messageObject);
                return;
            }

            var processingStartTime;
            if (InspectorBackendClass.Options.dumpInspectorTimeStats)
                processingStartTime = Date.now();

            this.agent(callback.domain).dispatchResponse(messageObject, callback.methodName, callback);
            --this._pendingResponsesCount;
            delete this._callbacks[messageObject.id];

            if (InspectorBackendClass.Options.dumpInspectorTimeStats)
                console.log("time-stats: " + callback.methodName + " = " + (processingStartTime - callback.sendRequestTime) + " + " + (Date.now() - processingStartTime));

            if (this._scripts && !this._pendingResponsesCount)
                this.runAfterPendingDispatches();
            return;
        } else {
            if (messageObject.error) {
                InspectorBackendClass.reportProtocolError("Generic message format error", messageObject);
                return;
            }
            var method = messageObject.method.split(".");
            var domainName = method[0];
            if (!(domainName in this._dispatchers)) {
                InspectorBackendClass.reportProtocolError("Protocol Error: the message " + messageObject.method + " is for non-existing domain '" + domainName + "'", messageObject);
                return;
            }

            this._dispatchers[domainName].dispatch(method[1], messageObject);
        }

    },

    /**
     * @param {string} domain
     * @param {!Object} dispatcher
     */
    registerDispatcher: function(domain, dispatcher)
    {
        if (!this._dispatchers[domain])
            return;

        this._dispatchers[domain].setDomainDispatcher(dispatcher);
    },

    /**
     * @param {string=} script
     */
    runAfterPendingDispatches: function(script)
    {
        if (!this._scripts)
            this._scripts = [];

        if (script)
            this._scripts.push(script);

        // Execute all promises.
        setTimeout(function() {
            if (!this._pendingResponsesCount)
                this._executeAfterPendingDispatches();
            else
                this.runAfterPendingDispatches();
        }.bind(this), 0);
    },

    _executeAfterPendingDispatches: function()
    {
        if (!this._pendingResponsesCount) {
            var scripts = this._scripts;
            this._scripts = [];
            for (var id = 0; id < scripts.length; ++id)
                scripts[id].call(this);
        }
    },

    _dumpProtocolMessage: function(message)
    {
        console.log(message);
    },

    /**
     * @protected
     * @param {string} reason
     */
    connectionClosed: function(reason)
    {
        this._isConnected = false;
        this._runPendingCallbacks();
        this.dispatchEventToListeners(InspectorBackendClass.Connection.Events.Disconnected, {reason: reason});
    },

    _runPendingCallbacks: function()
    {
        var keys = Object.keys(this._callbacks).map(function(num) { return parseInt(num, 10); });
        for (var i = 0; i < keys.length; ++i) {
            var callback = this._callbacks[keys[i]];
            this._dispatchConnectionErrorResponse(callback.domain, callback.methodName, callback);
        }
        this._callbacks = {};
    },

    /**
     * @param {string} domain
     * @param {string} methodName
     * @param {function(*)} callback
     */
    _dispatchConnectionErrorResponse: function(domain, methodName, callback)
    {
        var error = { message: "Connection is closed", code:  InspectorBackendClass._DevToolsErrorCode, data: null};
        var messageObject = {error: error};
        setTimeout(InspectorBackendClass.AgentPrototype.prototype.dispatchResponse.bind(this.agent(domain), messageObject, methodName, callback), 0);
    },

    /**
     * @return {boolean}
     */
    isClosed: function()
    {
        return !this._isConnected;
    },

    /**
     * @param {!Array.<string>} domains
     */
    suppressErrorsForDomains: function(domains)
    {
        domains.forEach(function(domain) { this._agents[domain].suppressErrorLogging(); }, this);
    },

    __proto__: WebInspector.Object.prototype

}

/**
 * @constructor
 * @extends {InspectorBackendClass.Connection}
 */
InspectorBackendClass.StubConnection = function(transport)
{
    InspectorBackendClass.Connection.call(this);
    this._transport = transport;
    this._transport.registerNuclideNotificationHandler(this.handleServerMessage.bind(this));
}

InspectorBackendClass.StubConnection.prototype = {
    /**
     * @override
     * @param {!Object} messageObject
     */
    sendMessage: function(messageObject)
    {
        var message = JSON.stringify(messageObject);
        this._transport.sendNuclideMessage(message);
    },

    handleServerMessage: function(message)
    {
        this.dispatch(message);
    },

    __proto__: InspectorBackendClass.Connection.prototype
}

/**
 * @constructor
 * @param {string} domain
 */
InspectorBackendClass.AgentPrototype = function(domain)
{
    this._replyArgs = {};
    this._hasErrorData = {};
    this._domain = domain;
    this._suppressErrorLogging = false;
    this._promisified = domain in InspectorBackendClass.AgentPrototype.PromisifiedDomains;
}

InspectorBackendClass.AgentPrototype.PromisifiedDomains = {
    "Profiler": true
}

InspectorBackendClass.AgentPrototype.prototype = {

    /**
     * @param {!InspectorBackendClass.Connection} connection
     */
    setConnection: function(connection)
    {
        this._connection = connection;
    },

    /**
     * @param {string} methodName
     * @param {!Array.<!Object>} signature
     * @param {!Array.<string>} replyArgs
     * @param {boolean} hasErrorData
     */
    registerCommand: function(methodName, signature, replyArgs, hasErrorData)
    {
        var domainAndMethod = this._domain + "." + methodName;

        /**
         * @param {...*} vararg
         * @this {InspectorBackendClass.AgentPrototype}
         */
        function sendMessage(vararg)
        {
            var params = Array.prototype.slice.call(arguments);
            InspectorBackendClass.AgentPrototype.prototype._sendMessageToBackend.call(this, domainAndMethod, signature, params);
        }

        /**
         * @param {...*} vararg
         * @this {InspectorBackendClass.AgentPrototype}
         * @return {!Promise.<*>}
         */
        function sendMessagePromise(vararg)
        {
            var params = Array.prototype.slice.call(arguments);
            return InspectorBackendClass.AgentPrototype.prototype._sendMessageToBackendPromise.call(this, domainAndMethod, signature, replyArgs, params);
        }

        this[methodName] = this._promisified ? sendMessagePromise : sendMessage;

        /**
         * @param {...*} vararg
         * @this {InspectorBackendClass.AgentPrototype}
         */
        function invoke(vararg)
        {
            var params = [domainAndMethod].concat(Array.prototype.slice.call(arguments));
            InspectorBackendClass.AgentPrototype.prototype._invoke.apply(this, params);
        }

        this["invoke_" + methodName] = invoke;

        this._replyArgs[domainAndMethod] = replyArgs;
        if (hasErrorData)
            this._hasErrorData[domainAndMethod] = true;
    },

    /**
     * @param {string} method
     * @param {!Array.<!Object>} signature
     * @param {!Array.<*>} args
     * @param {boolean} allowExtraUndefinedArg
     * @param {function(string)} errorCallback
     * @return {?Object}
     */
    _prepareParameters: function(method, signature, args, allowExtraUndefinedArg, errorCallback)
    {
        var params = {};
        var hasParams = false;
        for (var i = 0; i < signature.length; ++i) {
            var param = signature[i];
            var paramName = param["name"];
            var typeName = param["type"];
            var optionalFlag = param["optional"];

            if (!args.length && !optionalFlag) {
                errorCallback("Protocol Error: Invalid number of arguments for method '" + method + "' call. It must have the following arguments '" + JSON.stringify(signature) + "'.");
                return null;
            }

            var value = args.shift();
            if (optionalFlag && typeof value === "undefined")
                continue;

            if (typeof value !== typeName) {
                errorCallback("Protocol Error: Invalid type of argument '" + paramName + "' for method '" + method + "' call. It must be '" + typeName + "' but it is '" + typeof value + "'.");
                return null;
            }

            params[paramName] = value;
            hasParams = true;
        }

        if (args.length === 1 && (!allowExtraUndefinedArg || (typeof args[0] !== "undefined"))) {
            errorCallback("Protocol Error: Optional callback argument for method '" + method + "' call must be a function but its type is '" + typeof args[0] + "'.");
            return null;
        }

        if (args.length > 1) {
            errorCallback("Protocol Error: Extra " + args.length + " arguments in a call to method '" + method + "'.");
            return null;
        }

        return hasParams ? params : null
    },

    /**
     * @param {string} method
     * @param {!Array.<!Object>} signature
     * @param {!Array.<*>} args
     */
    _sendMessageToBackend: function(method, signature, args)
    {
        var errorMessage;
        /**
         * @param {string} message
         */
        function onError(message)
        {
            console.error(message)
            errorMessage = message;
        }
        var callback = (args.length && args.length > 0 && typeof args[args.length-1] === "function") ? args.pop() : null;
        var params = this._prepareParameters(method, signature, args, !callback, onError);
        if (errorMessage)
            return;
        this._connection._wrapCallbackAndSendMessageObject(this._domain, method, params, callback);
    },

    /**
     * @param {string} method
     * @param {!Array.<!Object>} signature
     * @param {!Array.<string>} replyArgs
     * @param {!Array.<*>} args
     * @return {!Promise.<*>}
     */
    _sendMessageToBackendPromise: function(method, signature, replyArgs, args)
    {
        var errorMessage;
        /**
         * @param {string} message
         */
        function onError(message)
        {
            console.error(message)
            errorMessage = message;
        }
        var params = this._prepareParameters(method, signature, args, false, onError);
        if (errorMessage)
            return Promise.reject(new Error(errorMessage));
        else
            return new Promise(promiseAction.bind(this));

        /**
         * @param {function(?)} resolve
         * @param {function(!Error)} reject
         * @this {InspectorBackendClass.AgentPrototype}
         */
        function promiseAction(resolve, reject)
        {
            /**
             * @param {?Protocol.Error} error
             * @param {?Object} result
             */
            function callback(error, result)
            {
                if (error) {
                    console.error(error);
                    resolve(null);
                    return;
                }
                resolve(replyArgs.length ? result : undefined);
            }
            this._connection._wrapCallbackAndSendMessageObject(this._domain, method, params, callback);
        }
    },

    /**
     * @param {string} method
     * @param {?Object} args
     * @param {?function(*)} callback
     */
    _invoke: function(method, args, callback)
    {
        this._connection._wrapCallbackAndSendMessageObject(this._domain, method, args, callback);
    },

    /**
     * @param {!Object} messageObject
     * @param {string} methodName
     * @param {function(*)|function(?Protocol.Error, ?Object)} callback
     */
    dispatchResponse: function(messageObject, methodName, callback)
    {
        if (messageObject.error && messageObject.error.code !== InspectorBackendClass._DevToolsErrorCode && !InspectorBackendClass.Options.suppressRequestErrors && !this._suppressErrorLogging) {
            console.error("Request with id = " + messageObject.id + " failed. " + JSON.stringify(messageObject.error));
        }

        if (this._promisified) {
            callback(messageObject.error && messageObject.error.message, messageObject.result);
            return;
        }

        var argumentsArray = [];
        argumentsArray[0] = messageObject.error ? messageObject.error.message: null;

        if (this._hasErrorData[methodName])
            argumentsArray[1] = messageObject.error ? messageObject.error.data : null;

        argumentsArray.push(messageObject.result);
        callback.apply(null, argumentsArray);
    },

    suppressErrorLogging: function()
    {
        this._suppressErrorLogging = true;
    }
}

/**
 * @constructor
 */
InspectorBackendClass.DispatcherPrototype = function()
{
    this._eventArgs = {};
    this._dispatcher = null;
}

InspectorBackendClass.DispatcherPrototype.prototype = {

    /**
     * @param {string} eventName
     * @param {!Object} params
     */
    registerEvent: function(eventName, params)
    {
        this._eventArgs[eventName] = params;
    },

    /**
     * @param {!Object} dispatcher
     */
    setDomainDispatcher: function(dispatcher)
    {
        this._dispatcher = dispatcher;
    },

    /**
     * @param {string} functionName
     * @param {!Object} messageObject
     */
    dispatch: function(functionName, messageObject)
    {
        if (!this._dispatcher)
            return;

        if (!(functionName in this._dispatcher)) {
            InspectorBackendClass.reportProtocolError("Protocol Error: Attempted to dispatch an unimplemented method '" + messageObject.method + "'", messageObject);
            return;
        }

        if (!this._eventArgs[messageObject.method]) {
            InspectorBackendClass.reportProtocolError("Protocol Error: Attempted to dispatch an unspecified method '" + messageObject.method + "'", messageObject);
            return;
        }

        var processingStartTime;
        if (InspectorBackendClass.Options.dumpInspectorTimeStats)
            processingStartTime = Date.now();

        this._dispatcher[functionName].apply(this._dispatcher, [messageObject.params]);

        if (InspectorBackendClass.Options.dumpInspectorTimeStats)
            console.log("time-stats: " + messageObject.method + " = " + (Date.now() - processingStartTime));
    }
}

function toTitleCase(str)
{
    return str.replace(/\w+/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

InspectorBackendClass.Options = {
    dumpInspectorTimeStats: false,
    dumpInspectorProtocolMessages: false,
    suppressRequestErrors: false
}

var InspectorBackend = new InspectorBackendClass();

InspectorBackendClass.bootstrap = function(transport)
{
    var path = require('path');
    return InspectorBackend.loadFromJSONIfNeeded(path.join(__dirname, 'protocol.json'), transport);
}

module.exports = InspectorBackendClass;
