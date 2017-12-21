# hapi-tracer
`hapi-tracer` provides a full hapi lifecycle trace.

Compatible with:
- node >=8.6.0
- hapi 16.x.x
- wreck 8.x.x
- catbox 7.x.x

## Install
`npm install --save hapi-tracer`

## Usage
```javascript
server.register({
  register: require('hapi-tracer'),
  options: {
    hapi: require('hapi'),
    wreck: require('wreck'),
    catbox: require('catbox'),
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
`hapi` - to instrument hapi, require hapi and assign.

`wreck` - to instrument wreck, require wreck and assign.

`catbox` - to instrument catbox, require catbox and assign.

`record` - record is a function that consumes a `trace` object. Use this function to record the request trace.
During a hapi request lifecycle - hapi middleware, methods and handlers are traced. Any http calls via wreck are also traced.
```javascript
{
 meta: {},                    // user generated meta
 aggregates: {                // aggregated trace stats
   middleware: {
     duration: 10,            // aggregated duration in ms
     count: 1,                // aggregated count
     percent: 16.67           // aggregated % of total request latency
   },
   methods: {
     duration: 10,
     count: 1
     percent: 16.67
   },
   handlers: {
     duration: 10,
     count: 1
     percent: 16.67
   },
   wreck: {
     duration: 10,
     count: 1
     percent: 16.67
   },
   catbox: {
     duration: 10,
     count: 1
     percent: 16.67
   },
   custom: {
     duration: 10,
     count: 1
     percent: 16.67
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
     percent: 16.67           // % of total request latency
   },
   {
     type: 'Handler',
     subType: 'getData',
     fncName: '<anonymous>',
     arity: 2,
     start: 1000010,
     end: 1000020,
     duration: 10,
     percent: 16.67
   },
   {
     type: 'Method',
     subType: 'add',
     fncName: 'add',
     arity: 3,
     start: 1000020,
     end: 1000030,
     duration: 10,
     percent: 16.67
   },
   {
     type: 'Wreck',
     subType: 'request',
     fncName: '<anonymous>',
     arity: 3,
     start: 1000030,
     end: 1000040,
     duration: 10,
     percent: 16.67
   },
   {
     type: 'Catbox',
     subType: 'request',
     fncName: '<anonymous>',
     arity: 3,
     start: 1000040,
     end: 1000050,
     duration: 10,
     percent: 16.67
   },
   {
     type: 'Custom',
     subType: 'request',
     fncName: '<anonymous>',
     arity: 3,
     start: 1000050,
     end: 1000060,
     duration: 10,
     percent: 16.67
   }
 ]
}
```

`generateMeta` - is an optional function that consumes a hapi request, the result of which will be appended to the `trace` object as `meta`.
Use this function to generate tags or meta data for your traces.

NB. Any uncovered time is recorded as `unknown`.

## Custom

`recordFn` and `recordProto` are also exposed on the `hapi.server` object - allowing you to append custom trace items.

`recordFn` example:
```javascript
  // decorate an inline function
  const fn = server.plugins['hapi-tracer'].recordFn(() => {...}, {
    name: 'MyFunc',
    type: 'Custom',
    isCb: false // is callback based
  });

  // execute function
  const result = fn(args);
```

`recordProto` example:
```javascript
  // decorate a prototype function 
  server.plugins['hapi-tracer'].recordProto(MyObjectPrototype, 'target', {
    name: 'MyFunc',
    type: 'Custom',
    isCb: false
  });
```