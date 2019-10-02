# post-message-rpc

[![Build Status](https://travis-ci.org/jurca/post-message-rpc.svg?branch=master)](https://travis-ci.org/jurca/post-message-rpc)
[![npm](https://img.shields.io/npm/v/@jurca/post-message-rpc.svg)](https://www.npmjs.com/package/@jurca/post-message-rpc)
[![License](https://img.shields.io/npm/l/@jurca/post-message-rpc.svg)](LICENSE)
![npm type definitions](https://img.shields.io/npm/types/@jurca/post-message-rpc.svg)

An RPC-like library for contexts connected via the postMessage API with
TypeScript support.

## Installation

`post-message-rpc` is available as npm package, you can use `npm` to install
it:

```
npm install --save @jurca/post-message-rpc
```

## Usage

There is separate API for the "server" (the RPC methods provider) and the
client.

### RPC Server

Use the `createServer` function to create an RPC server expecting procedure
calls from other contexts:

```javascript
import {createServer} from '@jurca/post-message-rpc'

createServer('channel ID', ['whitelist', 'of', 'origins'], {
  foo(x, y) {
    return x + y
  },
  bar(x) { // procedures may be asynchronous
    return new Promise((resolve) => setTimeout(resolve, x)).then(() => x)
  },
  baz() {
    // Errors thrown (synchronously or asynchronously) by procedures will be
    // propagated to the client.
    return Promise.reject(new Error('This is an error'))
  },
})
```

Using an empty array will allow calls from any origin, but is is strongly
recommended for security reasons to always use an origin whitelist.

### RPC Client

Use the `createClient` function to create an RPC client. Use the same channel
ID as the one used to create the RPC server you want to communicate with (Each
context may contain multiple servers and/or clients).

```javascript
import {createClient} from '@jurca/post-message-rpc'

(async () => {
  const client = await createClient(
    iframeWindow,
    {
      // Connection options, consumed by the @jurca/post-message-p2p package.

      // A string, number, symbol, boolean, null or undefined identifying the
      // communication channel with the peer.
      channel: 'channel ID',
      // An optional timeout for receiving a confirmation that the peer has
      // received the message, defaults to 10 seconds. Specified in
      // milliseconds, must be a positive integer.
      timeout: 100,
      // The optional origin that is allowed to receive messages sent through
      // this connection. Defaults to '*', but is recommended to be set for
      // security reasons.
      origin: 'https://some.origin.org',
      // The optional number of retries when trying to perform a handshake
      // with the provided peer. The connection will not be established if the
      // peer will not be responding to the handshake messages. Defaults to 2.
      handshakeRetries: 2,
      // An optional delay between handshake attempts in milliseconds.
      // Defaults to 500.
      handshakeRetryDelay: 3000,
    },
    {
      // This is a template listing the methods exposed by the server that the
      // client intends to use. While it would be possible to create an
      // implementation that uses the Proxy API rendering this argument not
      // needed, it would break compatibility with Internet Explorer.
      foo: null,
      bar: null,
    },
  )

  const firstResult = await client.foo(10, 12) // firstResult = 22
  const otherResult = await client.bar(500) // otherResult = 500

  try {
    await client.baz()
  } catch (error) {
    // The error will have the name, message and stack correctly set. The
    // stack will be the correct stack of the error thrown by the procedure at
    // the server.
  }
})()
```
