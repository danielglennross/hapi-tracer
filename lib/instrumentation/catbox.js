'use strict';

/*
  eslint-disable
  no-param-reassign,
  no-underscore-dangle,
  func-names
*/

const recorderFactory = require('../tracer/recorder');

function shimCatbox(recorder, prototype, target) {
  const original = prototype[target];
  const fn = recorder.new(target, original, 'Catbox', { isCb: true });
  prototype[target] = function methodWrap(...args) {
    return fn.call(this, ...args);
  };
}

module.exports = (config) => {
  const recorder = recorderFactory(config);

  return function instrumentCatbox(catbox) {
    const prototype = catbox.Client.prototype;
    if (!prototype) {
      throw new Error('Unkown catbox prototype, cannot instrument.');
    }

    ['get', 'set'].forEach(target => shimCatbox(recorder, prototype, target));
  };
};
