'use strict';

/* eslint-disable no-param-reassign */

function appendTracePercent(collection, latency) {
  return collection.map(c => (
    c = Object.assign({}, c, { percent: +((c.duration / latency) * 100).toFixed(2) })
  ));
}

function calcTraceAggregates(traces, latency) {
  const aggs = traces.reduce((acc, t) => {
    if (!acc.map(a => a.type).includes(t.type)) {
      acc = [...acc, { type: t.type, duration: 0, count: 0 }];
    }
    const match = acc.find(a => a.type === t.type);
    match.duration += t.duration;
    match.count++;
    return acc;
  }, []);

  return appendTracePercent(aggs, latency);
}

function populateTraceUnknowns(traces) {
  const indexOf = (arr, it) => arr.indexOf(arr.find(x => x.start === it.start));
  const itemsToInsert = [...traces].filter(t =>
    indexOf(traces, t) !== traces.length - 1 &&
    t.end < traces[indexOf(traces, t) + 1].start
  ).map(t => ({
    index: indexOf(traces, t) + 1, // shift to here
    start: t.end,
    end: traces[indexOf(traces, t) + 1].start
  }));
  itemsToInsert.forEach(t => traces.splice(t.index, 0, {
    type: 'Unknown',
    start: t.start,
    end: t.end,
    duration: t.end - t.start
  }));
}

module.exports = {
  appendTracePercent,
  calcTraceAggregates,
  populateTraceUnknowns
};
