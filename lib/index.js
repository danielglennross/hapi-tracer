'use strict';

/* 
  eslint-disable no-underscore-dangle,
  no-param-reassign,
  prefer-arrow-callback,
  func-names
*/

const hapi = require('hapi');
const cls = require('cls-hooked');

const ns = cls.createNamespace('thread');

const ctxId = 'ctx';
const traceId = 'trace';

const middlewareId = 'Middleware';
const methodId = 'Method';
const handlerId = 'Handler';

function startTrace(request, reply) {
  ns.bindEmitter(request.raw.req);
  ns.bindEmitter(request.raw.res);
  ns.run(() => {
    ns.set(ctxId, ns.createContext());
    return reply.continue();
  });
}

function endTrace({ record, generateTag, generateMeta }) {
  return function (request) {
    const traces = (ns.get('trace') || [])
      .sort(({ start: a }, { start: b }) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

    const track = {
      meta: generateMeta(request),
      aggregates: calcAggregates(traces),
      trace: calcTraces(traces)
    }

    record(track);
  };
}

function calcTraces(traces) {
  const latency = traces.map(t => t.duration).reduce((s, t) => (s += t), 0);
  return traces.map(t => (
    { ...t, percent: +((t.duration / latency) * 100).toFixed(2) })
  );
}

function calcAggregates(traces) {
  return traces.reduce((acc, t) => {
    if (!acc.map(a => a.type).includes(t.type)) {
      acc = [...acc, { type: t.type, duration: 0, count: 0 }];
    }
    const match = acc.find(a => a.type === t.type);
    match.duration += t.duration;
    match.count++
    return acc;
  }, []);
}

function recorder(subType, wrapped, type) {
  return function (...args) {
    const ctx = ns.get(ctxId);
    const traced = ns.bind(function () {

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

      const s = Date.now();
      const r = wrapped.call(this, ...args);

      // get trace after wrapped to correctly fetch context
      const t = ns.get(traceId) || [];

      // async
      if (r instanceof Promise) {
        return r.then(
          () => { record(t, s, Date.now()); return r; },
          () => { record(t, s, Date.now()); return Promise.reject(r); },
        );
      }

      // sync
      record(t, s, Date.now());
      return r;
    }, ctx)();

    return traced;
  };
}

function shim(prototype, target, type) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[name, fnc]) {
    fnc = recorder(name, fnc, type);
    return original.apply(this, [name, fnc]);
  };
}

function shimNested(prototype, target, type) {
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

exports.register = (server, options, next) => {
  const prototype = hapi.Server.super_.prototype;
  if (!prototype) {
    throw new Error('Unkown hapi prototype, cannot instrument.');
  }

  if (!(options.record && options.record instanceof Function)) {
    throw new Error('A `record` function must be provided.')
  }

  options.generateMeta = options.generateMeta || (() => {});
  if (!(options.generateMeta instanceof Function)) {
    throw new Error('`generateMeta` must be a function.')
  }

  server.ext('onRequest', startTrace);
  server.on('response', endTrace(options));

  shim(prototype, 'ext', middlewareId);
  shim(prototype, 'method', methodId);
  shimNested(prototype, 'handler', handlerId);

  next();
};

exports.register.attributes = {
  name: 'hapi-tracer',
  version: '1.0.0'
};