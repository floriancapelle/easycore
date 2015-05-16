/**
 * EasyCore
 *
 * @copyright:      Copyright © Florian Capelle
 * @author:         Florian Capelle <mail@floriancapelle.de>
 * @version         0.8.1
 * @license         MIT License
 *
 * @description     Simple scalable application structure.
 *                  Uses the facade pattern to only expose specific functions and properties to modules
 *                  and the 'Mediator' (https://github.com/floriancapelle/mediator) for easy event delegation.
 *                  Includes some functions of jQuery.
 */

// AMD, Node, or browser global
(function( root, factory ) {
    if ( typeof define === 'function' && define.amd ) {
        // AMD. Register as an anonymous module.
        define(['mediator'], factory);
    } else if ( typeof exports === 'object' ) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('Mediator'));
    } else {
        // Browser globals (root is window)
        factory(root, root.Mediator);
    }
}(this, function( root, Mediator ) {

    var _hasOwnProperty = ({}).hasOwnProperty;
    var isArray = Array.isArray;

    // a few helper functions
    function isWindow( obj ) {
        return obj != null && obj === obj.window;
    }

    function isObject( obj ) {
        return obj === Object(obj);
    }

    function getType( obj ) {
        if ( obj == null ) {
            return String(obj);
        }

        return typeof obj;
    }

    /**
     * copy of $.isPlainObject
     * @param obj
     * @returns {boolean}
     */
    function isPlainObject( obj ) {
        // Not plain objects:
        // - Any object or value whose internal [[Class]] property is not "[object Object]"
        // - DOM nodes
        // - window
        if ( getType(obj) !== "object" || obj.nodeType || isWindow(obj) ) {
            return false;
        }

        // Support: Firefox <20
        // The try/catch suppresses exceptions thrown when attempting to access
        // the "constructor" property of certain host objects, ie. |window.location|
        // https://bugzilla.mozilla.org/show_bug.cgi?id=814622
        //try {
        if ( obj.constructor && !_hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf") ) {
            return false;
        }
        //} catch ( e ) {
        //    return false;
        //}

        // If the function hasn't returned already, we're confident that
        // |obj| is a plain object, created by {} or constructed with new Object
        return true;
    }

    /**
     * copy of $.extend
     * @returns {*|{}}
     */
    function extend() {
        var options, name, src, copy, copyIsArray, clone,
            target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false;

        // Handle a deep copy situation
        if ( typeof target === "boolean" ) {
            deep = target;
            target = arguments[1] || {};
            // skip the boolean and the target
            i = 2;
        }

        // Handle case when target is a string or something (possible in deep copy)
        if ( typeof target !== "object" && getType(target) !== 'function' ) {
            target = {};
        }

        // extend 'this' itself if only one argument is passed
        if ( length === i ) {
            target = this;
            --i;
        }

        for ( ; i < length; i++ ) {
            // Only deal with non-null/undefined values
            if ( (options = arguments[i]) != null ) {
                // Extend the base object
                for ( name in options ) {
                    src = target[name];
                    copy = options[name];

                    // Prevent never-ending loop
                    if ( target === copy ) {
                        continue;
                    }

                    // Recurse if we're merging plain objects or arrays
                    if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = isArray(copy)) ) ) {
                        if ( copyIsArray ) {
                            copyIsArray = false;
                            clone = src && isArray(src) ? src : [];

                        } else {
                            clone = src && isPlainObject(src) ? src : {};
                        }

                        // Never move original objects, clone them
                        target[name] = extend(deep, clone, copy);

                        // Don't bring in undefined values
                    } else if ( copy !== undefined ) {
                        target[name] = copy;
                    }
                }
            }
        }

        // Return the modified object
        return target;
    }

    /**
     * EasyCore
     *
     * @param {object} [settings] - settings for the EasyCore
     * @global
     */
    var EasyCore = function( settings ) {
        /**
         * Default configuration
         * @namespace
         * @property {object} defaults
         * @property {bool} defaults.debug - expose internal modules, extensions - NOT RECOMMENDED FOR PRODUCTION
         * @property {bool} defaults.logErrorsViaConsole - use log errors in try-catch statements via console (set to false when using a separate logging extension)
         * @property {object} defaults.modules - module configuration pool, if required, not recommended here, define separately in each module
         * @property {object} defaults.extensions - extension configuration pool, if required, not recommended here, define separately in each extension
         */
        var defaults = {
            debug: false,
            logErrorsViaConsole: true,
            modules: {},
            extensions: {}
        };

        var self = this;
        /** @type {object} - merged conf */
        var conf = extend({}, defaults, settings);
        /** @type {object} - module pool, modules will be pushed in here */
        var modules = {};
        /** @type {object} - extension pool, extensions will be pushed in here */
        var extensions = {};
        /** @type {object} - sandbox mediator, save it to keep the channel */
        var sandboxMediator;

        /** @constant {string} - Current version */
        var VERSION = "0.8.1";

        /** @type {string[]} - module types to register and their callback to invoke on init.
         * can be extended with extensions pushing more pairs in the map.
         * BEWARE: functions will be invoked with core as context.
         */
        this.moduleTypeMap = {
            standard: registerStandardModule,
            extension: registerExtension
        };

        /**
         * Initialization
         *
         * @returns {object} this
         */
        function init() {
            // create a mediator instance for the core
            if ( !Mediator ) throw 'EasyCore needs the Mediator';

            // configurable this properties
            if ( conf.debug === true ) {
                this.modules = modules;
                this.extensions = extensions;
                this.conf = conf;
            }

            // Create the sandbox mediator
            sandboxMediator = new Mediator({exposeChannel: conf.debug});

            // Initialize modules
            var module;
            for ( var moduleId in modules ) {
                module = modules[moduleId];

                // module already instantiated
                if ( module.instance !== null ) break;

                // Create a new sandbox instance
                var sandbox = new self.Sandbox();

                // append the sandbox mediator to enable event management and keep the private channel
                extend(sandbox, sandboxMediator);

                // just for comprehension and debugging
                sandbox._moduleId = moduleId;

                if ( conf.debug === true ) {
                    module.sandbox = sandbox;
                }

                try {
                    module.instance = new module.creator(sandbox, conf.modules[moduleId]);
                } catch ( err ) {
                    if ( conf.logErrorsViaConsole === true ) {
                        console.log(err);
                    }
                    this.trigger('error', 'initModule', 'creation and init function: ' + moduleId, err);
                }
            }

            this.trigger('afterInit', this);

            // Prevent further calls
            this.init = function() {
                return this;
            };
            return this;
        }

        /**
         * start each module
         *
         * @param {string|string[]} [specificModules]
         * @returns {object} this
         */
        function start( specificModules ) {
            if ( getType(specificModules) == 'string' ) {
                startModule(specificModules);
            }
            else if ( isArray(specificModules) ) {
                for ( var i = 0, len = specificModules.length; i < len; i++ ) {
                    startModule(specificModules[i]);
                }
            }
            else {
                for ( var module in modules ) {
                    // skip the module if the autostart setting is set to false
                    if ( conf.modules[module] && conf.modules[module].autostart === false ) continue;
                    startModule(module);
                }
            }

            this.trigger('afterStart', this);
            return this;
        }

        /**
         * stop each module
         *
         * @param {string|string[]} [specificModules]
         * @returns {object} this
         */
        function stop( specificModules ) {
            if ( getType(specificModules) == 'string' ) {
                stopModule(specificModules);
            }
            else if ( isArray(specificModules) ) {
                for ( var i = 0, len = specificModules.length; i < len; i++ ) {
                    stopModule(specificModules[i]);
                }
            }
            else {
                for ( var module in modules ) {
                    stopModule(module);
                }
            }

            this.trigger('afterStop', this);
            return this;
        }

        /**
         * Register a module
         *
         * @param {string} id
         * @param {function} creator
         * @param {object} conf - actually redundant as the variable already
         *                        exists in this scope, completion reasons only
         * @returns void
         */
        function registerStandardModule( id, creator, conf ) {
            if ( modules[id] ) {
                this.trigger('warning', 'registerStandardModule', 'Given id exists already: ' + id);
                return;
            }

            modules[id] = {
                creator: creator,
                instance: null
            };
        }

        /**
         * Register an extension
         *
         * Will be invoked immediately.
         * Use core callbacks like afterInit to react and prepare the extension or to extend it.
         *
         * @param {string} id
         * @param {function} creator
         * @param {object} conf - actually redundant as the variable already
         *                        exists in this scope, completion reasons only
         * @returns void
         */
        function registerExtension( id, creator, conf ) {
            if ( extensions[id] ) {
                this.trigger('error', 'registerExtension', 'Given id exists already: ' + id);
                return;
            }

            // Invoke extension
            try {
                extensions[id] = new creator(this, conf.extensions[id], {
                    sandboxMediator: sandboxMediator,
                    coreSettings: conf
                });
            } catch ( err ) {
                if ( conf.logErrorsViaConsole === true ) {
                    console.log(err);
                }
                this.trigger('error', 'registerExtension', id, err);
            }
        }

        /**
         * Register a module/extension/function/*
         *
         * @param {string} id
         * @param {string|function} [arg1=standard] - type or creator
         * @param {function} arg2 - creator
         * @returns {object} this
         */
        function register( id, arg1, arg2 ) {
            var type,
                creator;

            if ( getType(arg1) == "function" ) {
                type = 'standard';
                creator = arg1;
            } else if ( getType(arg1) == "string" && !self.moduleTypeMap[arg1] ) {
                this.trigger('warning', 'register', 'Given module type does not exist: ' + arg1 + '(id: ' + id + ')');
            } else {
                type = arg1;
                creator = arg2;
            }

            if ( getType(id) != 'string' || !id.length ) {
                this.trigger('warning', 'register', 'Given id is not of type string or empty: ' + id);
                return this;
            }
            if ( getType(creator) != 'function' ) {
                this.trigger('warning', 'register', 'Given creator not of type function: ' + id);
            }

            // invoke (custom) register callback with core as context
            self.moduleTypeMap[type].call(this, id, creator, conf);

            return this;
        }

        /**
         * Start a module
         *
         * @param {string} moduleId - module id
         * @returns void
         */
        function startModule( moduleId ) {
            var module = modules[moduleId];

            if ( getType(moduleId) != 'string' || !modules[moduleId] ) {
                this.trigger('warning', 'startModule', 'Given module id is not of type string or does not exist: ' + moduleId);
                return;
            }

            if ( module.instance && getType(module.instance.start) == 'function' ) {
                module.instance.start();
            }
        }

        /**
         * Stop a module
         *
         * @param {string} moduleId - module id
         */
        function stopModule( moduleId ) {
            var module = modules[moduleId];

            if ( getType(moduleId) != 'string' || !modules[moduleId] ) {
                this.trigger('warning', 'stopModule', 'Given module id is not of type string or does not exist: ' + moduleId);
                return;
            }

            // stop the module
            if ( module.instance !== null && getType(module.instance.stop) == 'function' ) {
                try {
                    module.instance.stop();
                    module.instance = null;
                } catch ( err ) {
                    if ( conf.logErrorsViaConsole === true ) {
                        console.log(err);
                    }
                    this.trigger('warning', 'stopModule', 'stop function: ' + moduleId, err);
                }
            }
        }

        // append mediator to enable event management
        extend(EasyCore.prototype, new Mediator({exposeChannel: conf.debug}));

        return extend(this, {
            VERSION: VERSION,

            // shorthand, so the Mediator will not be a separate dependency
            // for the modules and extensions
            Mediator: Mediator,

            // provide frequently used utility functions
            extend: extend,
            isObject: isObject,
            getType: getType,
            isPlainObject: isPlainObject,
            register: register,
            init: init,
            start: start,
            stop: stop
        });
    };

    /**
     * EasyCore Sandbox
     * Reference only, all methods and properties should be added via extensions
     */
    EasyCore.prototype.Sandbox = function() {};

    // Expose EasyCore
    root.EasyCore = EasyCore;

    return EasyCore;

}));