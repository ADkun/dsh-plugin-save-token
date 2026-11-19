import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeExpandEchoLedger, expandEchoKey } from '../src/compress.js'

function payload() {
  var rows = []
  for (var i = 0; i < 300; i++) rows.push({ i: i, v: 'x'.repeat(20) })
  var text = JSON.stringify({ rows: rows })
  return { text: text, locator: 'C:/spill/x.txt', truncated: false }
}

test('expandEchoKey ignores short strings, fingerprints long ones', () => {
  assert.equal(expandEchoKey('short'), null)
  assert.notEqual(expandEchoKey('y'.repeat(300)), null)
})

test('ledger: raw text, compact JSON and pretty JSON all hit', () => {
  var l = makeExpandEchoLedger()
  var v = payload()
  l.note(v)
  assert.equal(l.hit(v.text), true)                      // console.log/return obj.text
  assert.equal(l.hit(JSON.stringify(v)), true)           // console.log(JSON.stringify(obj))
  assert.equal(l.hit(JSON.stringify(v, null, 2)), true)  // return obj (pretty JSON)
  assert.equal(l.hit(v.text + '\n'), true)               // trailing newline tolerated
})

test('ledger: whitespace-padded echo still hits (trim variants)', () => {
  var l = makeExpandEchoLedger()
  var text = '\n' + 'a'.repeat(400) + '\n' + 'b'.repeat(400) + '\n'
  l.note({ text: text, locator: 'L', truncated: false })
  assert.equal(l.hit(text), true)
  assert.equal(l.hit('\n\n' + text + '\n\n'), true) // extra surrounding newlines
})

test('ledger: unrelated large output misses', () => {
  var l = makeExpandEchoLedger()
  l.note(payload())
  assert.equal(l.hit('z'.repeat(2000)), false)
  assert.equal(l.hit(JSON.stringify({ rows: [1, 2, 3] })), false)
})

test('ledger: ttl expiry', () => {
  var l = makeExpandEchoLedger({ ttlMs: 1000 })
  var v = payload()
  l.note(v)
  assert.equal(l.hit(v.text), true)
  assert.equal(l.hit(v.text, Date.now() + 5000), false)
})

test('ledger: note ignores non-string text and caps size', () => {
  var l = makeExpandEchoLedger({ cap: 2 })
  l.note({ text: 123 })
  l.note({ text: 'q'.repeat(300) })
  l.note({ text: 'w'.repeat(300) })
  l.note({ text: 'e'.repeat(300) })
  assert.ok(l.size() <= 8)
})
