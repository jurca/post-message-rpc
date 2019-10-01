import {connect, createAgent, IConnectOptions, listen} from '@jurca/post-message-p2p'
import mapFactory from 'key-master'

interface IPostMessageImplementor {
  postMessage: typeof postMessage
}

interface IInvocation {
  callId: string
  procedure: string
  arguments: unknown[]
}

type RpcApi = { // tslint:disable-line interface-over-type-literal
  [procedureName: string]: undefined | ((...args: any[]) => Promise<unknown>),
}

type RpcApiClient = { // tslint:disable-line interface-over-type-literal
  [procedureName: string]: (...args: any[]) => Promise<any>,
}

const HOST_ID = Date.now().toString(36)
let lastClientId = -9007199254740991 // Number.MIN_SAFE_INTEGER

export function createClient<P extends RpcApiClient>(
  server: IPostMessageImplementor,
  options: IConnectOptions,
  clientTemplate: {[procedureName in keyof P]: any},
): Promise<P> {
  const clientId = `${HOST_ID}:${(++lastClientId).toString(36)}`
  let lastCallId = -9007199254740991 // Number.MIN_SAFE_INTEGER
  const pendingCallsCallbacks = {} as {[callId: string]: [(result: unknown) => void, (error: Error) => void]}

  return createAgent({
    ...options,
    peer: server,
    onMessage(data: unknown): void {
      if (
        typeof data !== 'object' ||
        !data ||
        typeof (data as any).callId !== 'string' ||
        !(pendingCallsCallbacks[(data as any).callId]) ||
        (
          !('error' in data) && !('result' in data)
        )
      ) {
        return
      }

      const {callId, error, result} = data as any
      if ('result' in data) {
        pendingCallsCallbacks[callId][0](result)
      } else {
        pendingCallsCallbacks[callId][1](Object.assign(new Error(), error))
      }
      delete pendingCallsCallbacks[callId]
    },
  }).then((sendMessage) => {
    const client = {} as P
    for (const key of Object.keys(clientTemplate) as Array<keyof P>) {
      client[key] = ((...args: unknown[]) => {
        const callId = `${clientId}:${(++lastCallId).toString(36)}`
        const resultPromise = new Promise((resolve, reject) => {
          pendingCallsCallbacks[callId] = [resolve, reject]
        })
        return sendMessage({
          arguments: args,
          callId,
          procedure: key,
        }).then(() => resultPromise)
      }) as P[typeof key]
    }
    return client
  })
}

export function createServer<P extends RpcApi>(channel: unknown, clientOrigins: string[], procedures: P): void {
  listen(channel, clientOrigins, (data: unknown, peer: IPostMessageImplementor, origin: string) => {
    if (!data || typeof data !== 'object') {
      return
    }

    if (
      typeof (data as any).procedure !== 'string' ||
      typeof (data as any).callId !== 'string' ||
      !((data as any).arguments instanceof Array)
    ) {
      return
    }

    const call = data as IInvocation
    let callTry
    if (typeof procedures[call.procedure] === 'function') {
      callTry = new Promise((resolve, reject) => {
        try {
          Promise.resolve(procedures[call.procedure]!(...call.arguments)).then(resolve, reject)
        } catch (error) {
          reject(error)
        }
      })
      callTry.then(
        (result: unknown) => sendResultToClient(peer, channel, origin, call.callId, null, result),
      ).catch(
        (error) => sendResultToClient(peer, channel, origin, call.callId, error, null),
      )
    } else {
      callTry = sendResultToClient(
        peer,
        channel,
        origin,
        call.callId,
        new Error(`The procedure ${call.procedure} is not provided by this server`),
        null,
      )
    }

    callTry.catch((error) => console.error('RPC communication failed', error)) // tslint:disable-line no-console
  })
}

const replyConnections = mapFactory((peer: IPostMessageImplementor) => mapFactory((channel: unknown) => mapFactory(
  (origin: string) => connect(peer, {channel, origin}),
)))

function sendResultToClient(
  peer: IPostMessageImplementor,
  channel: unknown,
  origin: string,
  callId: string,
  error: null | Error,
  result: unknown,
): Promise<void> {
  const wrappedResult = error ?
    {
      callId,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    }
  :
    {
      callId,
      result,
    }
  const replyConnectionPromise = replyConnections.get(peer).get(channel).get(origin) as ReturnType<typeof connect>
  return replyConnectionPromise.then((sendMessage) => sendMessage(wrappedResult))
}
