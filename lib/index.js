'use strict';

/*
  eslint-disable
  no-underscore-dangle,
  no-proto,
  no-param-reassign,
  prefer-arrow-callback,
  func-names
*/

const cls = require('cls-hooked');

const ns = cls.createNamespace('thread');
const traceId = 'trace';

const middlewareId = 'Middleware';
const methodId = 'Method';
const handlerId = 'Handler';
const httpId = 'Http';

function appendPercent(collection, latency) {
  return collection.map(c => (
    { ...c, percent: +((c.duration / latency) * 100).toFixed(2) }
  ));
}

function calcAggregates(traces, latency) {
  const aggs = traces.reduce((acc, t) => {
    if (!acc.map(a => a.type).includes(t.type)) {
      acc = [...acc, { type: t.type, duration: 0, count: 0 }];
    }
    const match = acc.find(a => a.type === t.type);
    match.duration += t.duration;
    match.count++;
    return acc;
  }, []);

  return appendPercent(aggs, latency);
}

function startTrace(request, reply) {
  ns.bindEmitter(request.raw.req);
  ns.bindEmitter(request.raw.res);
  ns.run(() => {
    ns.set(traceId, []);
    reply.continue();
  });
}

function endTrace(record, generateMeta) {
  return function (request) {
    const traces = (ns.get(traceId) || [])
      .sort(({ start: a }, { start: b }) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

    const latency = traces
      .map(t => t.duration)
      .reduce((sum, t) => (sum += t), 0);

    const track = {
      meta: generateMeta(request),
      aggregates: calcAggregates(traces, latency),
      trace: appendPercent(traces, latency)
    };

    record(track);
  };
}

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

function recorder(subType, wrapped, type, { isCb = false } = {}) {
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

function wrapOrOrig(wrapped, original) {
  // only wrap if within a current trace
  const trace = ns.get(traceId);
  return trace ? wrapped : original;
}

function shimWreck(prototype, target, type) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...args) {
    const fn = wrapOrOrig(
      recorder(target, original, type, { isCb: true }),
      original
    );
    return fn.call(this, ...args);
  };
}

function shimHapiNested(prototype, target, type) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[name, fnc]) {
    const wrapped = fnc;
    fnc = function wrap(...args) {
      const nestedWrapped = wrapped.call(this, ...args);
      return recorder(name, nestedWrapped, type);
    };
    return original.apply(this, [name, fnc]);
  };
}

function shimHapi(prototype, target, type) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[name, fnc]) {
    fnc = recorder(name, fnc, type);
    return original.apply(this, [name, fnc]);
  };
}

function instrumentWreck(wreck) {
  ['get', 'delete', 'patch', 'post', 'put', 'request', 'read']
    .forEach(target => shimWreck(wreck.__proto__, target, httpId))
}

function instrumentHapi(hapi) {
  const prototype = hapi.Server.super_.prototype;
  if (!prototype) {
    throw new Error('Unkown hapi prototype, cannot instrument.');
  }

  shimHapi(prototype, 'ext', middlewareId);
  shimHapi(prototype, 'method', methodId);
  shimHapiNested(prototype, 'handler', handlerId);
}

exports.register = (server, options, next) => {
  const { 
    hapi,
    wreck,
    record,
    generateMeta = () => {}
  } = options;

  if (!(record && record instanceof Function)) {
    return next(Error('A `record` function must be provided.'));
  }

  if (!(generateMeta instanceof Function)) {
    return next(new Error('`generateMeta` must be a function.'));
  }

  server.ext('onRequest', startTrace);
  server.on('response', endTrace(record, generateMeta));

  try {
    if (hapi)  { instrumentHapi(hapi);   }
    if (wreck) { instrumentWreck(wreck); }    
  } catch (err) {
    return next(err);
  }

  return next();
};

exports.register.attributes = {
  name: 'hapi-tracer',
  version: '1.0.0'
};
