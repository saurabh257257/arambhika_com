// TEMPORARY test-mode storage: a flat JSON file, not a database, because this whole feature
// is restricted to one hardcoded test mobile number (see server.js ALLOWED_TEST_MOBILE).
// Replace with lib/db.js (or similar) once real multi-customer OTP login is wired up.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'data')
const FILE = path.join(DATA_DIR, 'test-store.json')

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return { profile: null, orders: [] }
  }
}

function write(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(data, null, 1))
}

export function getProfile() {
  return read().profile
}

export function saveProfile(profile) {
  const data = read()
  data.profile = profile
  write(data)
  return profile
}

export function addOrder(order) {
  const data = read()
  data.orders.unshift(order)
  write(data)
  return order
}

export function getOrders() {
  return read().orders
}

export function updateOrder(id, patch) {
  const data = read()
  const order = data.orders.find((o) => o.id === id)
  if (!order) return null
  Object.assign(order, patch)
  write(data)
  return order
}
