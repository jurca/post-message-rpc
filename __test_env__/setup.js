// https://jestjs.io/docs/en/configuration#testenvironment-string

const NodeEnvironment = require('jest-environment-node')

module.exports =class MockBrowserEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup()
    this.global.addEventListener = makeMockFunction()
    this.global.postMessage = makeMockFunction()
  }
}

function makeMockFunction() {
  const mock = (...args) => {
    mock.calls.push(args)
  }
  mock.calls = []
  return mock
}
