// Indian states and union territories. `gst` is the two-digit state code that opens every GSTIN;
// `code` is the short code Zoho's checkout expects (see lib/zoho-checkout.js).
//
// The merged union territory "Dadra and Nagar Haveli and Daman and Diu" (GST code 26) is listed so
// a GSTIN registered there is recognised, but it is not offered in the address dropdown because
// the short code Zoho's checkout accepts for it has not been confirmed.

export const STATES = [
  { name: 'Andaman and Nicobar Islands', code: 'AN', gst: '35' },
  { name: 'Andhra Pradesh', code: 'AP', gst: '37' },
  { name: 'Arunachal Pradesh', code: 'AR', gst: '12' },
  { name: 'Assam', code: 'AS', gst: '18' },
  { name: 'Bihar', code: 'BR', gst: '10' },
  { name: 'Chandigarh', code: 'CH', gst: '04' },
  { name: 'Chhattisgarh', code: 'CG', gst: '22' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN', gst: '26', selectable: false },
  { name: 'Delhi', code: 'DL', gst: '07' },
  { name: 'Goa', code: 'GA', gst: '30' },
  { name: 'Gujarat', code: 'GJ', gst: '24' },
  { name: 'Haryana', code: 'HR', gst: '06' },
  { name: 'Himachal Pradesh', code: 'HP', gst: '02' },
  { name: 'Jammu and Kashmir', code: 'JK', gst: '01' },
  { name: 'Jharkhand', code: 'JH', gst: '20' },
  { name: 'Karnataka', code: 'KA', gst: '29' },
  { name: 'Kerala', code: 'KL', gst: '32' },
  { name: 'Ladakh', code: 'LA', gst: '38' },
  { name: 'Lakshadweep', code: 'LD', gst: '31' },
  { name: 'Madhya Pradesh', code: 'MP', gst: '23' },
  { name: 'Maharashtra', code: 'MH', gst: '27' },
  { name: 'Manipur', code: 'MN', gst: '14' },
  { name: 'Meghalaya', code: 'ML', gst: '17' },
  { name: 'Mizoram', code: 'MZ', gst: '15' },
  { name: 'Nagaland', code: 'NL', gst: '13' },
  { name: 'Odisha', code: 'OR', gst: '21' },
  { name: 'Puducherry', code: 'PY', gst: '34' },
  { name: 'Punjab', code: 'PB', gst: '03' },
  { name: 'Rajasthan', code: 'RJ', gst: '08' },
  { name: 'Sikkim', code: 'SK', gst: '11' },
  { name: 'Tamil Nadu', code: 'TN', gst: '33' },
  { name: 'Telangana', code: 'TG', gst: '36' },
  { name: 'Tripura', code: 'TR', gst: '16' },
  { name: 'Uttar Pradesh', code: 'UP', gst: '09' },
  { name: 'Uttarakhand', code: 'UK', gst: '05' },
  { name: 'West Bengal', code: 'WB', gst: '19' },
]

export const selectableStates = () => STATES.filter((s) => s.selectable !== false)

const byLowerName = new Map(STATES.map((s) => [s.name.toLowerCase(), s]))
const byGst = new Map(STATES.map((s) => [s.gst, s]))

/** The canonical state entry for a typed or selected name (case-insensitive), or null. */
export function findState(name) {
  return byLowerName.get(String(name || '').trim().toLowerCase()) || null
}

export function stateForGstCode(code) {
  return byGst.get(String(code)) || null
}

export const isValidPostalCode = (v) => /^[1-9]\d{5}$/.test(String(v || '').trim())
export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim())
