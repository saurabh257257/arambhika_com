// Local preview only: fills a data folder with a few made-up members, customers, vendors and items so the pages have something to show.
// Usage: node scripts/seed-demo.js <data folder>      (never run this against real data)
'use strict';
const path = require('path');
const { open } = require('../lib/db');

if (!process.argv[2]) { console.error('Give a data folder: node scripts/seed-demo.js ./demo-data'); process.exit(1); }
const repo = open(path.resolve(process.argv[2]));
const L = repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
const V = repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
repo.addCustomer({ name: 'Rakesh Shah', mobile: '98111 00001', company: 'Shakti Batteries Pvt Ltd', city: 'Pune', state: 'Maharashtra', source: 'email', source_detail: 'Mailed the website enquiry form', buyer_type: 'oem', address: 'Plot 12, MIDC Bhosari', about: 'Makes e-bike and e-scooter battery packs for 3 brands.', business: 'battery_pack_maker', looking_for: 'Nickel strip 0.15 mm', application: 'e-bike battery packs', cell_format: '18650', monthly_volume: '20 kg a month', urgency: 'within_a_month', ownerId: L.id }, L.id);
repo.addCustomer({ name: 'Volt Works', mobile: '98111 00002', company: 'Volt Works', city: 'Indore', buyer_type: 'trader', business: 'reseller_dealer', source: 'indiamart', looking_for: 'Copper busbar 55x20x2 mm', ownerId: V.id }, V.id);
repo.saveContact('9811100001', { mobile: '98111 00011', name: 'Anil Shah', role: 'Purchase head', email: 'anil@shakti.example' }, L.id);
repo.saveContact('9811100001', { mobile: '98111 00012', name: 'Meena Joshi', role: 'Accounts', notes: 'Call after 3 pm' }, L.id);
repo.addCustomer({ name: 'Kiran Patel', mobile: '98111 00003', company: 'Patel Energy', state: 'Gujarat', city: 'Surat', buyer_type: 'trader', ownerId: null }, L.id);
repo.addInteraction({ mobile: '9811100001', type: 'call', summary: 'First call. Interested in nickel strip 0.15 mm, about 20 kg a month.', nextDate: day(3) }, L.id);
repo.addInteraction({ mobile: '9811100001', type: 'quote', summary: 'Sent quote on WhatsApp: nickel strip 20 kg at Rs 750 a kg.', amount: 15000 }, L.id);
repo.addInteraction({ mobile: '9811100001', type: 'order', summary: 'Confirmed the order, wants delivery by Friday.', amount: 15000 }, L.id);
repo.addInteraction({ mobile: '9811100001', type: 'payment', summary: 'Payment received by UPI.', amount: 15000 }, V.id);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
repo.addFile({ mobile: '9811100001', name: 'payment-screenshot.png', mime: 'image/png', buffer: png }, V.id);
repo.addInteraction({ mobile: '9811100002', type: 'whatsapp', summary: 'Asked for copper busbar 55x20x2 mm price.', nextDate: day(1) }, V.id);
repo.replaceItems([
  { id: 'p1', sku: 'NS-015', name: 'Nickel strip 0.15 mm x 8 mm', category: 'Nickel strip', price: 900, stock: 25, unit: 'kg', moq: 1, description: 'Pure nickel strip for spot welding 18650 cells.', collections: ['18650'] },
  { id: 'p2', sku: 'NS-020', name: 'Nickel strip 0.20 mm x 8 mm', category: 'Nickel strip', price: 1100, stock: 0, unit: 'kg', moq: 1, description: 'Thicker strip for higher current packs.', collections: ['21700'] },
  { id: 'p3', sku: 'BMS-4S', name: 'BMS 4S 30A', category: 'BMS', price: 650, stock: 12, unit: 'pcs', description: 'Balanced BMS for 4S lithium packs.' },
  { id: 'p4', sku: 'CB-552', name: 'Copper busbar 55x20x2 mm', category: 'Busbar', price: 480, stock: 40, unit: 'pcs' },
]);
repo.addVendor({ name: 'Saurav Metals', mobile: '90000 00001', company: 'Saurav Metals', city: 'Mumbai', itemIds: ['p1', 'p4'], notes: 'Usually has nickel strip in stock. Pays supplier credit 15 days.' }, L.id);
repo.addVendor({ name: 'Anil Traders', mobile: '90000 00002', city: 'Delhi', itemIds: ['p1'] }, V.id);
repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 700, unit: 'kg', quantity: '200 kg', offerDate: day(-3) }, L.id);
repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 685, unit: 'kg', quantity: '150 kg', validTill: day(5) }, L.id);
repo.addOffer({ vendorMobile: '9000000002', itemId: 'p1', rate: 690, unit: 'kg', quantity: '500 kg' }, V.id);
repo.addOffer({ vendorMobile: '9000000001', itemId: 'p4', rate: 340, unit: 'pcs' }, L.id);
const rel = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10), line = [{ name: 'Nickel strip 0.15 mm x 8 mm', quantity: 20, rate: 750, total: 15000 }];
repo.saveBooksDocs('9811100001', {
  invoices: [{ number: 'INV-000112', date: rel(60), due_date: rel(45), total: 20000, balance: 0, status: 'paid', lines: line }, { number: 'INV-000131', date: rel(30), due_date: rel(22), total: 15000, balance: 15000, status: 'sent', lines: line }],
  orders: [{ number: 'SO-00041', date: rel(10), total: 12000, status: 'open', shipped_status: 'not_shipped', invoiced_status: 'not_invoiced', lines: line }, { number: 'SO-00044', date: rel(2), total: 7000, status: 'open', shipped_status: 'shipped', invoiced_status: 'not_invoiced' }],
  quotes: [{ number: 'EST-00019', date: rel(3), total: 8000, status: 'accepted' }],
}, L.id);
repo.updateVendor('9000000001', { address: 'Lohar Chawl, Mumbai', about: 'Nickel and copper strip maker', payment_terms: '15 days credit', lead_time: '3 days', min_order: '50 kg' }, L.id);
repo.addNote('vendor', '9000000001', 'Pays on time. Quality was poor in the October lot, check thickness on delivery.', L.id);
repo.addNote('item', 'p1', 'Customers ask for this one most. Keep 50 kg in stock.', V.id);
repo.addAttachment({ kind: 'vendor', key: '9000000001', name: 'price-list-nov.png', mime: 'image/png', note: 'November price list', buffer: png }, L.id);
repo.addAttachment({ kind: 'item', key: 'p1', name: 'datasheet.pdf', mime: 'application/pdf', note: 'Supplier datasheet', buffer: Buffer.from('%PDF-1.4 demo') }, L.id);
repo.setZohoStatus('9811100001', true, 'Shakti Batteries Pvt Ltd', L.id);
repo.setZohoStatus('9811100003', false, '', L.id);
console.log('Demo data ready (members lokesh / vikas, password name-pass-1234)');
repo.close();
