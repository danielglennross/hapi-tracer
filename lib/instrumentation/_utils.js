'use strict';

function wrapOrOrig({ traceId, ns }, wrapped, original) {
  // only wrap if within a current trace
  const trace = ns.get(traceId);
  return trace ? wrapped : original;
}

module.exports = {
  wrapOrOrig
};
