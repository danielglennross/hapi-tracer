'use strict';

/*
  eslint-disable
  no-param-reassign,
  no-underscore-dangle,
  func-names
*/

const recorderFactory = require('../tracer/recorder');

function shimRoute(recorder, prototype, target) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[route]) {
    route.forEach(rt => {
      if (rt.handler instanceof Function) {
        const wrapped = rt.handler;
        const name = `[${rt.method}] ${rt.path}`;
        rt.handler = recorder.new(name, wrapped, 'Handler');
      }
    });
    return original.apply(this, [route]);
  };
}

function shimHandler(recorder, prototype, target) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[name, fnc]) {
    const wrapped = fnc;
    fnc = function wrap(...args) {
      const nestedWrapped = wrapped.call(this, ...args);
      return recorder.new(name, nestedWrapped, 'Handler');
    };
    return original.apply(this, [name, fnc]);
  };
}

function shimHapiHook(recorder, prototype, target, type) {
  const original = prototype[target];
  prototype[target] = function methodWrap(...[name, fnc]) {
    fnc = recorder.new(name, fnc, type);
    return original.apply(this, [name, fnc]);
  };
}

module.exports = (config) => {
  const recorder = recorderFactory(config);

  return function instrumentHapi(hapi) {
    const prototype = hapi.Server.super_.prototype;
    if (!prototype) {
      throw new Error('Unkown hapi prototype, cannot instrument.');
    }

    shimRoute(recorder, prototype, 'route');
    shimHandler(recorder, prototype, 'handler');
    shimHapiHook(recorder, prototype, 'ext', 'Middleware');
    shimHapiHook(recorder, prototype, 'method', 'Method');
  };
};
