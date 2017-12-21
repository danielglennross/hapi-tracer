'use strict';

/*
  eslint-disable
  no-param-reassign,
  func-names
*/

const recorderFactory = require('../tracer/recorder');

const { wrapOrOrig } = require('./_utils');

function recordFn(recorder, config) {
  return function (original, { name = '<anonymous>', type = 'Custom', isCb = false } = {}) {
    const fn = wrapOrOrig(
      config,
      recorder.new(name, original, type, { isCb }),
      original
    );
    return function (...args) {
      return fn.call(this, ...args);
    };
  };
}

function recordProto(recorder, config) {
  return function (prototype, target, { name = '<anonymous>', type = 'Custom', isCb = false } = {}) {
    const original = prototype[target];
    const fn = wrapOrOrig(
      config,
      recorder.new(name, original, type, { isCb }),
      original
    );
    prototype[target] = function wrapped(...args) {
      return fn.call(this, ...args);
    };
  };
}

module.exports = (config) => {
  const recorder = recorderFactory(config);

  return {
    recordFn: recordFn(recorder, config),
    recordProto: recordProto(recorder, config)
  };
};
