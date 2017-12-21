'use strict';

/*
  eslint-disable
  no-param-reassign,
  no-proto
*/

const recorderFactory = require('../tracer/recorder');

function wrapOrOrig({ traceId, ns }, wrapped, original) {
  // only wrap if within a current trace
  const trace = ns.get(traceId);
  return trace ? wrapped : original;
}

function shimWreck(recorder, prototype, target, config) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...args) {
    const fn = wrapOrOrig(
      config,
      recorder.new(target, original, 'Wreck', { isCb: true }),
      original
    );
    return fn.call(this, ...args);
  };
}

module.exports = (config) => {
  const recorder = recorderFactory(config);

  return function instrumentWreck(wreck) {
    if (!wreck) {
      throw new Error('Unkown wreck instance, cannot instrument.');
    }

    ['get', 'delete', 'patch', 'post', 'put', 'request', 'read']
      .forEach(target => shimWreck(recorder, wreck.__proto__, target, config));
  };
};
