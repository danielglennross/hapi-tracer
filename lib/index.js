'use strict';

/*
  eslint-disable
  no-param-reassign,
  func-names
*/

const cls = require('cls-hooked');

const {
  populateTraceUnknowns,
  calcTraceAggregates,
  appendTracePercent
} = require('./tracer/calculator');

const config = {
  ns: cls.createNamespace('thread'),
  traceId: 'trace'
};

const instrumentHapi = require('./instrumentation/hapi')(config);
const instrumentWreck = require('./instrumentation/wreck')(config);
const instrumentCatbox = require('./instrumentation/catbox')(config);
const { recordFn, recordProto } = require('./instrumentation/custom')(config);

function startTrace(request, reply) {
  const { ns, traceId } = config;

  ns.bindEmitter(request.raw.req);
  ns.bindEmitter(request.raw.res);
  ns.run(() => {
    ns.set(traceId, []);
    reply.continue();
  });
}

function endTrace(record, generateMeta) {
  const { ns, traceId } = config;

  return function (request) {
    const traces = (ns.get(traceId) || [])
      .sort(({ start: a }, { start: b }) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });

    populateTraceUnknowns(traces);

    const latency = traces
      .map(t => t.duration)
      .reduce((sum, t) => (sum += t), 0);

    const track = {
      meta: generateMeta(request),
      aggregates: calcTraceAggregates(traces, latency),
      trace: appendTracePercent(traces, latency)
    };

    record(track);
  };
}

exports.register = (server, options, next) => {
  const {
    hapi,
    wreck,
    catbox,
    record,
    generateMeta = () => {}
  } = options;

  if (!(record && record instanceof Function)) {
    return next(new Error('A `record` function must be provided.'));
  }

  if (!(generateMeta instanceof Function)) {
    return next(new Error('`generateMeta` must be a function.'));
  }

  server.ext('onRequest', startTrace);
  server.on('response', endTrace(record, generateMeta));

  server.expose({ recordFn, recordProto });

  try {
    if (hapi) { instrumentHapi(hapi); }
    if (wreck) { instrumentWreck(wreck); }
    if (catbox) { instrumentCatbox(catbox); }
  } catch (err) {
    return next(err);
  }

  return next();
};

exports.register.attributes = {
  name: 'hapi-tracer',
  version: '1.0.0'
};
