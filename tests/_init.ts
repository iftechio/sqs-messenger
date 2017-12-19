import test from 'ava'
import 'source-map-support/register'
import * as sinon from 'sinon'

test.beforeEach(t => {
  t.context.sandbox = sinon.sandbox.create()
})

test.afterEach.always(t => {
  t.context.sandbox.restore()
})

export default test
