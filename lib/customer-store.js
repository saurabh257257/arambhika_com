// Per-customer storage: one JSON file per mobile number under data/customers/, holding that
// customer's profile, orders and saved cart. Flat files are fine at this size; swap this module
// for a database when volume needs it — every function takes the mobile number first, so the
// call sites don't change.
//
// data/test-store.json (the old single-customer file) is read once to seed the matching
// customer the first time they are looked up.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data')
const DIR = path.join(DATA_DIR, 'customers')
const LEGACY = path.join(DATA_DIR, 'test-store.json')

export const normalizeMobile = (v) => String(v || '').replace(/\D/g, '').slice(-10)

function fileFor(mobile) {
  const m = normalizeMobile(mobile)
  if (m.length !== 10) throw new Error('Invalid mobile number')
  return path.join(DIR, `${m}.json`)
}

function legacyFor(mobile) {
  try {
    const data = JSON.parse(fs.readFileSync(LEGACY, 'utf8'))
    const owner = normalizeMobile(data.profile?.phone)
    if (owner && owner === normalizeMobile(mobile)) return data
  } catch {}
  return null
}

function read(mobile) {
  try {
    const data = JSON.parse(fs.readFileSync(fileFor(mobile), 'utf8'))
    if (!data.cart) data.cart = {}
    if (!data.orders) data.orders = []
    return data
  } catch {
    const legacy = legacyFor(mobile)
    if (legacy) return { profile: legacy.profile || null, orders: legacy.orders || [], cart: legacy.cart || {} }
    return { profile: null, orders: [], cart: {} }
  }
}

// Written to a temp file then renamed, so a crash mid-write can't leave a half-written file.
function write(mobile, data) {
  fs.mkdirSync(DIR, { recursive: true })
  const file = fileFor(mobile)
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1))
  fs.renameSync(tmp, file)
}

export function getProfile(mobile) {
  return read(mobile).profile
}

export function saveProfile(mobile, profile) {
  const data = read(mobile)
  data.profile = profile
  write(mobile, data)
  return profile
}

export function addOrder(mobile, order) {
  const data = read(mobile)
  data.orders.unshift(order)
  write(mobile, data)
  return order
}

export function getOrders(mobile) {
  return read(mobile).orders
}

export function updateOrder(mobile, id, patch) {
  const data = read(mobile)
  const order = data.orders.find((o) => o.id === id)
  if (!order) return null
  Object.assign(order, patch)
  write(mobile, data)
  return order
}

export function getCart(mobile) {
  return read(mobile).cart || {}
}

export function saveCart(mobile, cart) {
  const data = read(mobile)
  data.cart = cart && typeof cart === 'object' ? cart : {}
  write(mobile, data)
  return data.cart
}

// Admin view: every customer's orders, each tagged with whose it is.
export function getAllOrders() {
  let files = []
  try { files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')) } catch {}
  const all = []
  for (const f of files) {
    const mobile = f.replace('.json', '')
    for (const o of read(mobile).orders) all.push({ ...o, mobile })
  }
  return all
}
