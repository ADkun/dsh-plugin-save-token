import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesPassthrough, normalizePassthroughPatterns, filterPassthroughTools, togglePassthroughTool, selectPassthroughTools, deselectPassthroughTools } from '../src/passthrough.js'

test('empty or missing patterns never exempt a tool', () => {
  assert.equal(matchesPassthrough('bash'), false)
  assert.equal(matchesPassthrough('bash', []), false)
  assert.equal(matchesPassthrough('bash', null), false)
  assert.equal(matchesPassthrough(undefined, ['bash']), false)
})

test('full tool name matches exactly that tool', () => {
  assert.equal(matchesPassthrough('bash', ['bash']), true)
  assert.equal(matchesPassthrough('read_image', ['read_image']), true)
  assert.equal(matchesPassthrough('bash', ['read_image']), false)
})

test('keyword pattern covers every tool whose name contains it', () => {
  const patterns = ['search']
  assert.equal(matchesPassthrough('web_search', patterns), true)
  assert.equal(matchesPassthrough('search_context', patterns), true)
  assert.equal(matchesPassthrough('anysearch_batch_search', patterns), true)
  assert.equal(matchesPassthrough('bash', patterns), false)
})

test('matching is case-insensitive and trims whitespace', () => {
  assert.equal(matchesPassthrough('web_search', ['  WEB_  ']), true)
  assert.equal(matchesPassthrough('READ', [' read ']), true)
})

test('blank and non-string patterns are ignored', () => {
  assert.equal(matchesPassthrough('bash', ['', '   ', null, 7, {}]), false)
  assert.equal(matchesPassthrough('bash', ['', 'bash']), true)
})

test('filter selects a case-insensitive substring view', () => {
  const tools = [{ name: 'web_search' }, { name: 'search_context' }, { name: 'bash' }]
  assert.deepEqual(filterPassthroughTools(tools, 'SEARCH').map(t => t.name), ['web_search', 'search_context'])
  assert.deepEqual(filterPassthroughTools(tools, '').map(t => t.name), ['web_search', 'search_context', 'bash'])
  assert.deepEqual(filterPassthroughTools(null, 'x'), [])
})

test('checkbox toggle unchecks a keyword-covered tool by removing the rule', () => {
  const patterns = ['search', 'bash']
  const next = togglePassthroughTool(patterns, 'web_search')
  assert.deepEqual(next, ['bash'])
  assert.equal(matchesPassthrough('web_search', next), false)
  assert.equal(matchesPassthrough('search_context', next), false)
  assert.deepEqual(patterns, ['search', 'bash'])
})

test('checkbox toggle adds an exact name and never duplicates it', () => {
  assert.deepEqual(togglePassthroughTool([], 'web_search'), ['web_search'])
  assert.deepEqual(togglePassthroughTool(['web_search'], 'web_search'), [])
  assert.deepEqual(togglePassthroughTool(['WEB_SEARCH'], 'web_search'), [])
  assert.deepEqual(togglePassthroughTool(['bash'], 'read'), ['bash', 'read'])
  assert.deepEqual(togglePassthroughTool(['bash'], 7), ['bash'])
})

test('select-all writes exact visible names, never the filter keyword', () => {
  const visible = filterPassthroughTools([{ name: 'web_search' }, { name: 'search_context' }, { name: 'bash' }], 'search')
  const next = selectPassthroughTools(['bash'], visible)
  assert.deepEqual(next, ['bash', 'web_search', 'search_context'])
  assert.equal(matchesPassthrough('anysearch_batch_search', next), false)
  assert.deepEqual(selectPassthroughTools(next, visible), next)
  assert.deepEqual(selectPassthroughTools(['a'], null), ['a'])
})

test('deselect-all removes rules covering visible tools and keeps hidden-only rules', () => {
  const visible = filterPassthroughTools([{ name: 'web_search' }, { name: 'search_context' }, { name: 'bash' }], 'search')
  const patterns = ['search', 'web_search', 'bash', 'READ']
  const next = deselectPassthroughTools(patterns, visible)
  assert.deepEqual(next, ['bash', 'READ'])
  assert.equal(matchesPassthrough('web_search', next), false)
  assert.equal(matchesPassthrough('search_context', next), false)
  assert.deepEqual(patterns, ['search', 'web_search', 'bash', 'READ'])
  assert.deepEqual(deselectPassthroughTools(patterns, []), patterns)
  assert.deepEqual(deselectPassthroughTools(['a'], null), ['a'])
})

test('select-all then deselect-all leaves no rule or checked row behind', () => {
  const visible = [{ name: 'web_search' }, { name: 'anysearch_batch_search' }]
  const selected = selectPassthroughTools([], visible)
  assert.deepEqual(selected, ['web_search', 'anysearch_batch_search'])
  const cleared = deselectPassthroughTools(selected, visible)
  assert.deepEqual(cleared, [])
  assert.deepEqual(visible.map(t => matchesPassthrough(t.name, cleared)), [false, false])
})

test('host coverage and panel checkbox agree after every rule change', () => {
  const tools = ['web_search', 'search_context', 'anysearch_batch_search', 'bash']
  const checked = patterns => tools.filter(name => matchesPassthrough(name, patterns))
  let patterns = ['search']
  assert.deepEqual(checked(patterns), ['web_search', 'search_context', 'anysearch_batch_search'])
  patterns = togglePassthroughTool(patterns, 'web_search')
  assert.deepEqual(checked(patterns), [])
  patterns = selectPassthroughTools(patterns, [{ name: 'web_search' }, { name: 'bash' }])
  assert.deepEqual(checked(patterns), ['web_search', 'bash'])
})

test('disk rules normalize to one spelling per case-insensitive rule', () => {
  const raw = ['  Web_Search ', 'web_search', '', '   ', null, 7, 'BASH', 'bash', ' read ']
  assert.deepEqual(normalizePassthroughPatterns(raw), ['Web_Search', 'BASH', 'read'])
  assert.deepEqual(normalizePassthroughPatterns(null), [])
  assert.deepEqual(normalizePassthroughPatterns([]), [])
})

test('adding a differently-cased duplicate is a no-op in the panel', () => {
  const existing = ['bash']
  assert.deepEqual(normalizePassthroughPatterns(existing.concat('BASH')), existing)
})

test('a normalized empty selection stays empty instead of reviving defaults', () => {
  const saved = normalizePassthroughPatterns(['', '  ', 42])
  assert.deepEqual(saved, [])
  assert.equal(matchesPassthrough('bash', saved), false)
})
