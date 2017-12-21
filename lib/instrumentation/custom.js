'use strict';

/*
  eslint-disable
  no-param-reassign,
  func-names
*/

const recorderFactory = require('../tracer/recorder');

function recordFn(recorder) {
  return function (fnc, { name = '<anonymous>', type = 'Custom', isCb = false } = {}) {
    const fn = recorder.new(name, fnc, type, { isCb });
    return function (...args) {
      return fn.call(this, ...args);
    };
  };
}

function recordProto(recorder) {
  return function (prototype, target, { name = '<anonymous>', type = 'Custom', isCb = false } = {}) {
    const original = prototype[target];
    const fn = recorder.new(name, original, type, { isCb });
    prototype[target] = function wrapped(...args) {
      return fn.call(this, ...args);
    };
  };
}

module.exports = (config) => {
  const recorder = recorderFactory(config);

  return {
    recordFn: recordFn(recorder),
    recordProto: recordProto(recorder)
  };
};
