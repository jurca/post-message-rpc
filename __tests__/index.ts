import {createClient, createServer} from '../index'

const globalMessageListener = (addEventListener as any).calls[0][1]

describe('createClient', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  it('should connect to the target context, create a proxying client and enable calling the server', async () => {
    type IClient = { // tslint:disable-line interface-over-type-literal
      foo(x: number): Promise<number>,
      bar(y: string, z: number): Promise<string>,
    }
    const clientTemplate = {
      bar: null,
      foo: null,
      [`random${Math.random()}`]: null,
    }
    const peer = {
      postMessage: jest.fn(),
    }
    const clientConnectionPromise = createClient<IClient>(peer, {channel: 0}, clientTemplate)
    globalMessageListener({
      data: {
        channel: 0,
        messageId: peer.postMessage.mock.calls[0][0].messageId,
        received: true,
      },
      origin: '*',
      source: peer,
    })
    const client = await clientConnectionPromise

    for (const procedure of Object.keys(clientTemplate)) {
      expect(typeof (client as any)[procedure]).toBe('function')
    }

    const call1Promise = client.foo(15)
    const callMessage = peer.postMessage.mock.calls[1][0]
    expect(callMessage.data).toEqual({
      arguments: [15],
      callId: callMessage.data.callId,
      procedure: 'foo',
    })
    expect(typeof callMessage.data.callId).toBe('string')
    expect(/:-2gosa7pa2gu:-2gosa7pa2gu$/.test(callMessage.data.callId)).toBe(true)
    globalMessageListener({
      data: {
        channel: 0,
        messageId: callMessage.messageId,
        received: true,
      },
      origin: '*',
      source: peer,
    })
    const clientListener = (addEventListener as any).calls[1][1]
    clientListener({
      data: {
        channel: 0,
        data: {
          callId: callMessage.data.callId,
          result: 987,
        },
        messageId: 'msgId',
      },
      origin: '*',
      source: peer,
    })
    const result1 = await call1Promise
    expect(result1).toBe(987)

    const call2Promise = client.bar('abc', 556)
    const call2Message = peer.postMessage.mock.calls[3][0]
    expect(call2Message.data).toEqual({
      arguments: ['abc', 556],
      callId: call2Message.data.callId,
      procedure: 'bar',
    })
    expect(call2Message.data.callId).not.toBe(callMessage.data.callId)
    globalMessageListener({
      data: {
        channel: 0,
        messageId: call2Message.messageId,
        received: true,
      },
      origin: '*',
      source: peer,
    })
    clientListener({
      data: {
        channel: 0,
        data: {
          callId: call2Message.data.callId,
          error: {name: 'PostMessageRpcError', message: 'fooBarBaz 582852', stack: 'PostMessageRpcError: abc\ndef'},
        },
        messageId: 'msgId2',
      },
      origin: '*',
      source: peer,
    })
    try {
      await call2Promise
      throw new Error('The call should have been rejected')
    } catch (error) {
      expect(error.name).toBe('PostMessageRpcError')
      expect(error.message).toBe('fooBarBaz 582852')
    }
  })

  afterEach(() => {
    (addEventListener as any).calls.splice(0)
    ;(postMessage as any).calls.splice(0) // tslint:disable-line align whitespace
    jest.clearAllTimers()
  })
})

describe('createServer', () => {
  it('should listen for calls, invoke the provided procedures, await and send results to the caller', async () => {
    createServer(0, [], {
      foo(x: number, y: string): Promise<string> {
        expect(x).toBe(123)
        expect(y).toBe('fooBar')
        return Promise.resolve('bar baz foo')
      },
    })
    const serverListener = (addEventListener as any).calls[0][1]
    const peer = {
      postMessage: jest.fn(),
    }
    serverListener({
      data: {
        channel: 0,
        data: {
          arguments: [123, 'fooBar'],
          callId: 'callId',
          procedure: 'foo',
        },
        messageId: 'msg1d',
      },
      origin: '*',
      source: peer,
    })

    // await connection to the sender for sending the reply with result
    while (peer.postMessage.mock.calls.length < 2) {
      await Promise.resolve()
    }
    expect(peer.postMessage).toHaveBeenLastCalledWith(
      {
        channel: 0,
        handshake: peer.postMessage.mock.calls[1][0].handshake,
        messageId: peer.postMessage.mock.calls[1][0].messageId,
      },
      '*',
      undefined,
    )
    globalMessageListener({
      data: {
        channel: 0,
        messageId: peer.postMessage.mock.calls[1][0].messageId,
        received: true,
      },
      origin: '*',
      source: peer,
    })
    // await the reply message
    while (peer.postMessage.mock.calls.length < 3) {
      await Promise.resolve()
    }
    expect(peer.postMessage).toHaveBeenLastCalledWith(
      {
        channel: 0,
        data: {
          callId: 'callId',
          result: 'bar baz foo',
        },
        messageId: peer.postMessage.mock.calls[2][0].messageId,
      },
      '*',
      undefined,
    )
  })

  it('should reject invalid messages', () => {
    const procedure = jest.fn()
    createServer(0, [], {foo: procedure})
    const replyListener = jest.fn()
    const serverListener = (addEventListener as any).calls[0][1]
    serverListener({
      data: {
        channel: 0,
        data: null,
        messageId: 'msgId',
      },
      origin: '*',
      source: {
        postMessage: replyListener,
      },
    })
    expect(procedure).not.toHaveBeenCalled()
    expect(replyListener).toHaveBeenCalledTimes(1)

    serverListener({
      data: {
        channel: 0,
        data: '',
        messageId: 'msgId',
      },
      origin: '*',
      source: {
        postMessage: replyListener,
      },
    })
    expect(procedure).not.toHaveBeenCalled()
    expect(replyListener).toHaveBeenCalledTimes(2)

    serverListener({
      data: {
        channel: 0,
        data: {
          callId: '',
          procedure: '',
        },
        messageId: 'msgId',
      },
      origin: '*',
      source: {
        postMessage: replyListener,
      },
    })
    expect(procedure).not.toHaveBeenCalled()
    expect(replyListener).toHaveBeenCalledTimes(3)

    serverListener({
      data: {
        channel: 0,
        data: {
          arguments: [],
          procedure: '',
        },
        messageId: 'msgId',
      },
      origin: '*',
      source: {
        postMessage: replyListener,
      },
    })
    expect(procedure).not.toHaveBeenCalled()
    expect(replyListener).toHaveBeenCalledTimes(4)

    serverListener({
      data: {
        channel: 0,
        data: {
          arguments: [],
          callId: '',
        },
        messageId: 'msgId',
      },
      origin: '*',
      source: {
        postMessage: replyListener,
      },
    })
    expect(procedure).not.toHaveBeenCalled()
    expect(replyListener).toHaveBeenCalledTimes(5)
  })

  afterEach(() => {
    (addEventListener as any).calls.splice(0)
    ;(postMessage as any).calls.splice(0) // tslint:disable-line align whitespace
    jest.clearAllTimers()
  })
})
