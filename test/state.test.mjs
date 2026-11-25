import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import fs, { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { STATE_FILE, statePath, readState, writeState } from '../src/state.js'
import { normalizePassthroughPatterns } from '../src/passthrough.js'

const root = mkdtempSync(join(tmpdir(), 'save-token-state-'))
const env = { DSH_HOME: root }
after(() => rmSync(root, { recursive: true, force: true }))

test('statePath uses DSH_HOME and ignores blank overrides', () => {
  assert.equal(statePath(env), join(root, STATE_FILE))
  assert.equal(statePath({ DSH_HOME: '   ' }), join(homedir(), '.dsh', STATE_FILE))
})

test('statePath keeps DSH_HOME text verbatim, like the harness', () => {
  const padded = ' ' + root + ' '
  assert.equal(statePath({ DSH_HOME: padded }), join(resolve(padded), STATE_FILE))
})

test('saved patches merge, and a simulated restart reads them back', () => {
  writeState({ passthroughTools: ['  Web_Search ', 'web_search', '', 7] }, env)
  writeState({ dedupeEnabled: false }, env)
  const saved = readState(env)
  assert.equal(saved.dedupeEnabled, false)
  assert.deepEqual(normalizePassthroughPatterns(saved.passthroughTools), ['Web_Search'])
  assert.deepEqual(normalizePassthroughPatterns(readState(env).passthroughTools), ['Web_Search'])
})

test('clearing every rule persists [] instead of falling back to defaults', () => {
  writeState({ passthroughTools: [] }, env)
  assert.deepEqual(readState(env).passthroughTools, [])
})

test('a failed replace leaves the previous state intact', () => {
  const target = join(root, STATE_FILE)
  const before = '{"passthroughTools":["old"],"compressEnabled":false}'
  writeFileSync(target, before, 'utf8')
  const original = fs.renameSync
  fs.renameSync = function () { throw new Error('rename blocked') }
  try {
    assert.throws(function () { writeState({ passthroughTools: ['new'] }, env) }, /rename blocked/)
  } finally {
    fs.renameSync = original
  }
  assert.equal(readFileSync(target, 'utf8'), before)
  assert.equal(readdirSync(root).filter(function (name) { return name.endsWith('.tmp') }).length, 0)
  assert.deepEqual(readState(env).passthroughTools, ['old'])
})

test('missing and corrupt state is inert, including prototype keys', () => {
  const other = join(root, 'other')
  assert.deepEqual(Object.keys(readState({ DSH_HOME: other })), [])
  mkdirSync(other, { recursive: true })
  writeFileSync(join(other, STATE_FILE), '{not json', 'utf8')
  assert.deepEqual(Object.keys(readState({ DSH_HOME: other })), [])
  writeFileSync(join(other, STATE_FILE), '{"__proto__":{"polluted":true},"passthroughTools":["bash"]}', 'utf8')
  const saved = readState({ DSH_HOME: other })
  assert.deepEqual(saved.passthroughTools, ['bash'])
  assert.equal({}.polluted, undefined)
})
