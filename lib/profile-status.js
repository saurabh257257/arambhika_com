// What a customer still has to fill in, and how far along they are.
//
//   1  Verify mobile      always done once logged in
//   2  Your details       first name + last name + email
//   3  Delivery address   address, state, city, pincode
//   4  GST                an explicit yes/no; "yes" needs a valid GSTIN
//
// A customer may place an order once steps 1-3 are done and, if they said they have GST, step 4's
// number is valid. Progress counts each finished step as 25%.

import { findState, isValidPostalCode, isValidEmail } from './india.js'

export function profileStatus(profile) {
  const p = profile || {}
  const detailsDone = Boolean(String(p.firstName || '').trim() && String(p.lastName || '').trim() && isValidEmail(p.email))
  const addressDone = Boolean(
    String(p.address || '').trim() && findState(p.state) && String(p.city || '').trim() && isValidPostalCode(p.postalCode)
  )
  const gstValid = Boolean(p.gstin && p.gstVerified)
  const gstDecided = p.hasGst === false || (p.hasGst === true && gstValid)
  // Choosing "I have GST" without a valid number blocks ordering; saying nothing does not.
  const gstBlocking = p.hasGst === true && !gstValid

  const steps = [
    { id: 'mobile', label: 'Verify mobile', done: true },
    { id: 'details', label: 'Your details', done: detailsDone },
    { id: 'address', label: 'Delivery address', done: addressDone },
    { id: 'gst', label: 'GST (optional)', done: gstDecided },
  ]

  const missing = []
  if (!String(p.firstName || '').trim()) missing.push('firstName')
  if (!String(p.lastName || '').trim()) missing.push('lastName')
  if (!isValidEmail(p.email)) missing.push('email')
  if (!String(p.address || '').trim()) missing.push('address')
  if (!findState(p.state)) missing.push('state')
  if (!String(p.city || '').trim()) missing.push('city')
  if (!isValidPostalCode(p.postalCode)) missing.push('postalCode')
  if (gstBlocking) missing.push('gstin')

  const percent = steps.filter((s) => s.done).length * 25
  const nextStep = (steps.find((s) => !s.done) || {}).id || null

  return {
    complete: detailsDone && addressDone && !gstBlocking, // can place an order
    percent,
    steps,
    missing,
    nextStep,
  }
}
