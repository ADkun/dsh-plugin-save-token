/**
 * Passthrough matcher: listed tools keep every byte of their output — no
 * compression, no dedupe. Shared by the host waterfall and the settings panel
 * so "which tools are exempt" has exactly one meaning.
 *
 * A pattern is a case-insensitive substring of a tool name. Use a full name
 * to target one tool; a shorter word deliberately covers every name that
 * contains it. Blank and non-string entries are ignored.
 */
export function matchesPassthrough(name, patterns) {
  if (typeof name !== 'string' || !Array.isArray(patterns) || patterns.length === 0) return false
  const lower = name.toLowerCase()
  for (let i = 0; i < patterns.length; i++) {
    const raw = patterns[i]
    if (typeof raw !== 'string') continue
    const p = raw.trim().toLowerCase()
    if (p !== '' && lower.indexOf(p) !== -1) return true
  }
  return false
}

/**
 * One canonical spelling per rule. Matching is case-insensitive, so keeping
 * both `BASH` and `bash` only clutters the panel without changing behavior.
 * Also used when restoring rules from disk, where stale entries are common.
 */
export function normalizePassthroughPatterns(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = Object.create(null)
  for (let i = 0; i < raw.length; i++) {
    if (typeof raw[i] !== 'string') continue
    const p = raw[i].trim()
    if (p === '') continue
    const key = p.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(seen, key)) continue
    seen[key] = true
    out.push(p)
  }
  return out
}

/** Case-insensitive substring filter over {name, description} tool rows. */
export function filterPassthroughTools(tools, filter) {
  if (!Array.isArray(tools)) return []
  const words = String(filter || '').trim().toLowerCase()
  if (words === '') return tools.slice()
  return tools.filter(function (tool) {
    return !!tool && typeof tool.name === 'string' && tool.name.toLowerCase().indexOf(words) !== -1
  })
}

/**
 * One checkbox = one real exemption. Checking an uncovered tool adds its exact
 * name; unchecking a covered tool removes every rule that matches it, so the
 * checkbox can always undo what the host actually does.
 */
export function togglePassthroughTool(patterns, name, matcher) {
  const list = Array.isArray(patterns) ? patterns.slice() : []
  if (typeof name !== 'string') return list
  const matches = matcher || matchesPassthrough
  if (matches(name, list)) {
    return list.filter(function (p) { return !matches(name, [p]) })
  }
  if (list.indexOf(name) === -1) list.push(name)
  return list
}

/** Select-all writes exact names only; a filter keyword never becomes a rule. */
export function selectPassthroughTools(patterns, visibleTools) {
  const list = Array.isArray(patterns) ? patterns.slice() : []
  if (!Array.isArray(visibleTools)) return list
  for (let i = 0; i < visibleTools.length; i++) {
    const name = visibleTools[i] && visibleTools[i].name
    if (typeof name === 'string' && name !== '' && list.indexOf(name) === -1) list.push(name)
  }
  return list
}

/**
 * Deselect-all is the same-sized undo as select-all: drop every rule that
 * covers at least one visible tool, so no visible row stays checked because
 * of a keyword typed earlier. Rules that cover only hidden tools survive.
 */
export function deselectPassthroughTools(patterns, visibleTools, matcher) {
  const list = Array.isArray(patterns) ? patterns.slice() : []
  if (!Array.isArray(visibleTools) || visibleTools.length === 0) return list
  const matches = matcher || matchesPassthrough
  const names = []
  for (let i = 0; i < visibleTools.length; i++) {
    const name = visibleTools[i] && visibleTools[i].name
    if (typeof name === 'string' && name !== '') names.push(name)
  }
  return list.filter(function (p) {
    for (let i = 0; i < names.length; i++) if (matches(names[i], [p])) return false
    return true
  })
}
