# hapi-tracer
`hapi-tracer` traces hapi requests and provides a full lifecycle trace.

Compatible with:
- node >=8.6.0
- hapi 16.x.x
- wreck 8.x.x

## Install
`npm install --save hapi-tracer`

## Usage
```javascript
server.register({
  register: require('hapi-tracer'),
  options: {
    record: (trace) => console.log(`request trace: ${trace}`),
    generateMeta: (request) => ({ 
      route: `[${request.method}] ${request.path}`,
      correlationToken: request.correlationToken 
    })
  }
}, (err) => {
  console.error(err)
});
```

## Options
`record` is a function that consumes a `trace` object. Use this function to record the request trace.
During a hapi request lifecycle - hapi middleware, methods and handlers are traced. Any http calls via wreck are also traced.
```javascript
{
 meta: {},                    // user generated meta
 aggregates: {                // aggregated trace stats
   middleware: {
     duration: 10,            // aggregated duration in ms
     count: 1,                // aggregated count
     percent: 25              // aggregated % of total request latency
   },
   methods: {
     duration: 10,
     count: 1
     percent: 25
   },
   handlers: {
     duration: 10,
     count: 1
     percent: 25
   },
   http: {
     duration: 10,
     count: 1
     percent: 25
   }
 },
 trace: [                     // ordered trace items
   {
     type: 'Middleware',
     subType: 'onRequest',
     fncName: 'fetchHeaders', // if unknown, '<anonymous>'
     arity: 2,                // fnc arity
     start: 1000000,          // unix timestamp
     end: 1000010,            // unix timestamp
     duration: 10,            // ms
     percent: 33.33           // % of total request latency
   },
   {
     type: 'Handler',
     subType: 'getData',
     fncName: '<anonymous>',
     arity: 2,
     start: 1000010,
     end: 1000020,
     duration: 10,
     percent: 25
   },
   {
     type: 'Method',
     subType: 'add',
     fncName: 'add',
     arity: 3,
     start: 1000020,
     end: 1000030,
     duration: 10,
     percent: 25
   },
   {
     type: 'Http',
     subType: 'request',
     fncName: '<anonymous>',
     arity: 3,
     start: 1000030,
     end: 1000040,
     duration: 10,
     percent: 25
   },
 ]
}
```

`generateMeta` is an optional function that consumes a hapi request, the result of which will be appended to the `trace` object as `meta`.
Use this function to generate tags or meta data for your traces.