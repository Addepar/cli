(function() {
  (function (exports) {
    'use strict';

    const process = (typeof globalThis !== "undefined" && globalThis.process) || {};
    process.env = process.env || {};
    process.env.__PERCY_BROWSERIFIED__ = true;

    const {
      assign,
      entries
    } = Object; // matches ansi escape sequences

    const ANSI_REG = new RegExp('[\\u001B\\u009B][[\\]()#;?]*((?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)' + '|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g'); // color names by ansi escape code

    const ANSI_COLORS = {
      '91m': 'red',
      '32m': 'green',
      '93m': 'yellow',
      '34m': 'blue',
      '95m': 'magenta',
      '90m': 'grey'
    }; // colorize each line of a string using an ansi escape sequence

    const LINE_REG = /^.*$/gm;

    function colorize(code, str) {
      return str.replace(LINE_REG, line => `\u001b[${code}${line}\u001b[39m`);
    } // map ansi colors to bound colorize functions


    const colors = entries(ANSI_COLORS).reduce((colors, _ref) => {
      let [code, name] = _ref;
      return assign(colors, {
        [name]: colorize.bind(null, code)
      });
    }, {});

    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        obj[key] = value;
      }

      return obj;
    }

    const URL_REGEXP = /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/i;
    const LOG_LEVELS = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }; // A PercyLogger instance retains logs in-memory for quick lookups while also writing log
    // messages to stdout and stderr depending on the log level and debug string.

    class PercyLogger {
      // default log level
      // namespace regular expressions used to determine which debug logs to write
      // in-memory store for logs and meta info
      // track deprecations to limit noisy logging
      // static vars can be overriden for testing
      // Handles setting env var values and returns a singleton
      constructor() {
        _defineProperty(this, "level", 'info');

        _defineProperty(this, "namespaces", {
          include: [/^.*?$/],
          exclude: []
        });

        _defineProperty(this, "messages", new Set());

        _defineProperty(this, "deprecations", new Set());

        let {
          instance = this
        } = this.constructor;

        if (process.env.PERCY_DEBUG) {
          instance.debug(process.env.PERCY_DEBUG);
        } else if (process.env.PERCY_LOGLEVEL) {
          instance.loglevel(process.env.PERCY_LOGLEVEL);
        }

        this.constructor.instance = instance;
        return instance;
      } // Change log level at any time or return the current log level


      loglevel(level) {
        if (level) this.level = level;
        return this.level;
      } // Change namespaces by generating an array of namespace regular expressions from a
      // comma separated debug string


      debug(namespaces) {
        if (this.namespaces.string === namespaces) return;
        this.namespaces.string = namespaces;
        namespaces = namespaces.split(/[\s,]+/).filter(Boolean);
        if (!namespaces.length) return this.namespaces;
        this.loglevel('debug');
        this.namespaces = namespaces.reduce((namespaces, ns) => {
          ns = ns.replace(/:?\*/g, m => m[0] === ':' ? ':?.*?' : '.*?');

          if (ns[0] === '-') {
            namespaces.exclude.push(new RegExp('^' + ns.substr(1) + '$'));
          } else {
            namespaces.include.push(new RegExp('^' + ns + '$'));
          }

          return namespaces;
        }, {
          string: namespaces,
          include: [],
          exclude: []
        });
      } // Creates a new log group and returns level specific functions for logging


      group(name) {
        return Object.keys(LOG_LEVELS).reduce((group, level) => Object.assign(group, {
          [level]: this.log.bind(this, name, level)
        }), {
          deprecated: this.deprecated.bind(this, name),
          shouldLog: this.shouldLog.bind(this, name),
          progress: this.progress.bind(this, name),
          format: this.format.bind(this, name),
          loglevel: this.loglevel.bind(this),
          stdout: this.constructor.stdout,
          stderr: this.constructor.stderr
        });
      } // Query for a set of logs by filtering the in-memory store


      query(filter) {
        return Array.from(this.messages).filter(filter);
      } // Formats messages before they are logged to stdio


      format(debug, level, message, elapsed) {
        let label = 'percy';
        let suffix = '';

        if (arguments.length === 1) {
          // format(message)
          [debug, message] = [null, debug];
        } else if (arguments.length === 2) {
          // format(debug, message)
          [level, message] = [null, level];
        }

        if (this.level === 'debug') {
          // include debug info in the label
          if (debug) label += `:${debug}`; // include elapsed time since last log

          if (elapsed != null) {
            suffix = ' ' + colors.grey(`(${elapsed}ms)`);
          }
        }

        label = colors.magenta(label);

        if (level === 'error') {
          // red errors
          message = colors.red(message);
        } else if (level === 'warn') {
          // yellow warnings
          message = colors.yellow(message);
        } else if (level === 'info' || level === 'debug') {
          // blue info and debug URLs
          message = message.replace(URL_REGEXP, colors.blue('$&'));
        }

        return `[${label}] ${message}${suffix}`;
      } // Replaces the current line with a log message


      progress(debug, message, persist) {
        if (!this.shouldLog(debug, 'info')) return;
        let {
          stdout
        } = this.constructor;

        if (stdout.isTTY || !this._progress) {
          message && (message = this.format(debug, message));
          if (stdout.isTTY) stdout.cursorTo(0);else message && (message = message + '\n');
          if (message) stdout.write(message);
          if (stdout.isTTY) stdout.clearLine(1);
        }

        this._progress = !!message && {
          message,
          persist
        };
      } // Returns true or false if the level and debug group can write messages to stdio


      shouldLog(debug, level) {
        return LOG_LEVELS[level] != null && LOG_LEVELS[level] >= LOG_LEVELS[this.level] && !this.namespaces.exclude.some(ns => ns.test(debug)) && this.namespaces.include.some(ns => ns.test(debug));
      } // Ensures that deprecation messages are not logged more than once


      deprecated(debug, message, meta) {
        if (this.deprecations.has(message)) return;
        this.deprecations.add(message);
        this.log(debug, 'warn', `Warning: ${message}`, meta);
      } // Returns true if a socket is present and ready


      get isRemote() {
        var _this$socket;

        return ((_this$socket = this.socket) === null || _this$socket === void 0 ? void 0 : _this$socket.readyState) === 1;
      } // Generic log method accepts a debug group, log level, log message, and optional meta
      // information to store with the message and other info


      log(debug, level, message) {
        let meta = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
        // message might be an error object
        let isError = typeof message !== 'string' && (level === 'error' || level === 'debug');
        let error = isError && message; // if remote, send logs there

        if (this.isRemote) {
          // serialize error messages
          message = isError && 'stack' in error ? {
            message: error.message,
            stack: error.stack
          } : message;
          return this.socket.send(JSON.stringify({
            log: [debug, level, message, {
              remote: true,
              ...meta
            }]
          }));
        } // ensure the message is a string


        message = isError && message.stack || message.message || message.toString(); // timestamp each log

        let timestamp = Date.now();
        let entry = {
          debug,
          level,
          message,
          meta,
          timestamp
        };
        this.messages.add(entry); // maybe write the message to stdio

        if (this.shouldLog(debug, level)) {
          let elapsed = timestamp - (this.lastlog || timestamp);
          if (isError && this.level !== 'debug') message = error.toString();
          this.write(level, this.format(debug, error ? 'error' : level, message, elapsed));
          this.lastlog = timestamp;
        }
      } // Writes a message to stdio based on the loglevel


      write(level, message) {
        var _this$_progress;

        let {
          stdout,
          stderr
        } = this.constructor;
        let progress = stdout.isTTY && this._progress;

        if (progress) {
          stdout.cursorTo(0);
          stdout.clearLine();
        }

        (level === 'info' ? stdout : stderr).write(message + '\n');
        if (!((_this$_progress = this._progress) !== null && _this$_progress !== void 0 && _this$_progress.persist)) delete this._progress;else if (progress) stdout.write(progress.message);
      } // Opens a socket logging connection


      connect(socket) {
        // send logging environment info
        let PERCY_DEBUG = process.env.PERCY_DEBUG;
        let PERCY_LOGLEVEL = process.env.PERCY_LOGLEVEL || this.loglevel();
        socket.send(JSON.stringify({
          env: {
            PERCY_DEBUG,
            PERCY_LOGLEVEL
          }
        })); // attach remote logging handler

        socket.onmessage = _ref => {
          let {
            data
          } = _ref;
          let {
            log,
            logAll
          } = JSON.parse(data);
          if (logAll) logAll.forEach(e => this.messages.add(e));
          if (log) this.log(...log);
        }; // return a cleanup function


        return () => {
          socket.onmessage = null;
        };
      } // Connects to a remote logger


      async remote(createSocket) {
        let timeout = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
        if (this.isRemote) return; // if not already connected, wait until the timeout

        let err = await new Promise(resolve => {
          let done = event => {
            if (timeoutid == null) return;
            timeoutid = clearTimeout(timeoutid);
            if (this.socket) this.socket.onopen = this.socket.onerror = null;
            resolve((event === null || event === void 0 ? void 0 : event.error) || (event === null || event === void 0 ? void 0 : event.type) === 'error' && 'Error: Socket connection failed');
          };

          let timeoutid = setTimeout(done, timeout, {
            error: 'Error: Socket connection timed out'
          });
          Promise.resolve().then(async () => {
            this.socket = await createSocket();
            if (this.isRemote) return done();
            this.socket.onopen = this.socket.onerror = done;
          }).catch(error => done({
            error
          }));
        }); // there was an error connecting, will fallback to normal logging

        if (err) {
          this.log('logger', 'debug', 'Unable to connect to remote logger');
          this.log('logger', 'debug', err);
          return;
        } // send any messages already logged in this environment


        if (this.messages.size) {
          this.socket.send(JSON.stringify({
            logAll: Array.from(this.messages).map(entry => ({ ...entry,
              meta: {
                remote: true,
                ...entry.meta
              }
            }))
          }));
        } // attach an incoming message handler


        this.socket.onmessage = _ref2 => {
          let {
            data
          } = _ref2;
          let {
            env
          } = JSON.parse(data); // update local environment info

          if (env) Object.assign(process.env, env);
        }; // return a cleanup function


        return () => {
          this.socket.onmessage = null;
          this.socket = null;
        };
      }

    }

    _defineProperty(PercyLogger, "stdout", process.stdout);

    _defineProperty(PercyLogger, "stderr", process.stderr);

    class PercyBrowserLogger extends PercyLogger {
      write(level, message) {
        let out = ['warn', 'error'].includes(level) ? level : 'log';
        let colors = [];
        message = message.replace(ANSI_REG, (_, ansi) => {
          colors.push(`color:${ANSI_COLORS[ansi] || 'inherit'}`);
          return '%c';
        });
        console[out](message, ...colors);
      }

      progress() {
        console.error('The log.progress() method is not supported in browsers');
      }

    }

    function logger(name) {
      return new PercyBrowserLogger().group(name);
    }
    Object.assign(logger, {
      format: function () {
        return new PercyBrowserLogger().format(...arguments);
      },
      query: function () {
        return new PercyBrowserLogger().query(...arguments);
      },
      connect: function () {
        return new PercyBrowserLogger().connect(...arguments);
      },
      remote: function () {
        return new PercyBrowserLogger().remote(...arguments);
      },
      loglevel: function () {
        return new PercyBrowserLogger().loglevel(...arguments);
      }
    });
    Object.defineProperties(logger, {
      Logger: {
        get: () => PercyBrowserLogger
      },
      stdout: {
        get: () => PercyBrowserLogger.stdout
      },
      stderr: {
        get: () => PercyBrowserLogger.stderr
      }
    });

    exports["default"] = logger;
    exports.logger = logger;

    Object.defineProperty(exports, '__esModule', { value: true });

  })(this.PercyLogger = this.PercyLogger || {});
}).call(window);

if (typeof define === "function" && define.amd) {
  define([], () => window.PercyLogger);
} else if (typeof module === "object" && module.exports) {
  module.exports = window.PercyLogger;
}