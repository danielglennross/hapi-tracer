'use strict';

/* 
  eslint-disable
  no-param-reassign,
  func-names
*/

module.exports = function recorder(config) {
  const { traceId, ns } = config;

  function handleCallback(wrapped, record, args) {
    const callbackFns = args
      .reduce((acc, a) => {
        if (typeof a === 'function') {
          acc = [...acc, { arg: a, index: args.indexOf(a) }];
        }
        return acc;
      }, []);

    const callbackFn = callbackFns[callbackFns.length - 1];

    const orig = callbackFn.arg;
    const getAndFixStartForCb = function (start) {
      return function wrappedCallback(...args2) {
        const recordTraceCb = () => {
          const trace = ns.get(traceId);
          record(trace, start, Date.now());
        };
        try {
          const result = orig.call(this, ...args2);
          recordTraceCb();
          return result;
        } catch (err) {
          recordTraceCb();
          throw err;
        }
      };
    };
    args[callbackFn.index] = getAndFixStartForCb(Date.now());
    return wrapped.call(this, ...args);
  }

  function handleSyncOrAsync(wrapped, record, args) {
    const start = Date.now();
    const result = wrapped.call(this, ...args);

    const recordTrace = () => {
      // get trace after wrapped to correctly fetch context
      const trace = ns.get(traceId);
      record(trace, start, Date.now());
    };

    // async
    if (result instanceof Promise) {
      result.then(recordTrace, recordTrace);
      return result;
    }

    // sync
    recordTrace();
    return result;
  }

  return {
    new(subType, wrapped, type, { isCb = false } = {}) {
      return function (...args) {
        const { name: fncName, length: arity } = wrapped;

        const record = (trace, start, end) => {
          ns.set(traceId, [...trace, {
            type,
            subType,
            fncName: fncName || '<anonymous>',
            arity,
            start,
            end,
            duration: end - start
          }]);
        };

        // bind calling context to handler
        const handler = (
          isCb ? handleCallback : handleSyncOrAsync
        ).bind(this);

        return handler(wrapped, record, args);
      };
    }
  };
};
