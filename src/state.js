/**
 * Restart-safe storage for settings the dashboard owns.
 *
 * Panel edits must outlive the process that made them. We keep one small JSON
 * file under the same user-data root DSH itself uses ($DSH_HOME, else ~/.dsh),
 * never touching the global cordis.patch.yml. Static config stays the shipped
 * default; a saved panel choice wins after startup because it is the newer,
 * more specific statement of intent.
 */
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const STATE_FILE = 'save-token-state.json'

function expandHome(path) {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/** Same rule as the harness: only a blank $DSH_HOME is unset; path text is kept verbatim. */
export function statePath(env = process.env) {
  const raw = env && env.DSH_HOME
  const home = typeof raw === 'string' && raw.trim().length > 0 ? raw : join(homedir(), '.dsh')
  return join(resolve(expandHome(home)), STATE_FILE)
}

/** Missing, unreadable or corrupt state is treated as "no saved choice". */
export function readState(env = process.env) {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(env), 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out = Object.create(null)
    for (const key of Object.keys(parsed)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      out[key] = parsed[key]
    }
    return out
  } catch (e) {
    return {}
  }
}

/** Merge one patch into the saved state, then replace the file atomically. */
export function writeState(patch, env = process.env) {
  const path = statePath(env)
  const next = Object.assign(Object.create(null), readState(env), patch || {})
  const body = JSON.stringify(next, null, 2) + '\n'
  fs.mkdirSync(dirname(path), { recursive: true })
  const tmp = path + '.' + randomUUID() + '.tmp'
  try {
    fs.writeFileSync(tmp, body, 'utf8')
    fs.renameSync(tmp, path)
  } catch (e) {
    // A failed replace must leave the old file untouched. Direct writing the
    // target here would truncate saved choices if the second write also failed.
    fs.rmSync(tmp, { force: true })
    throw e
  }
  return next
}
