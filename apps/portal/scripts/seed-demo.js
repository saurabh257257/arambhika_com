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
repo.addCustomer({ name: 'Rakesh Shah', mobile: '98111 00001', company: 'Shakti Batteries Pvt Ltd', city: 'Pune', state: 'Maharashtra', source: 'email', source_detail: 'Mailed the website enquiry form', buyer_type: 'non_trader', business: 'battery_pack_maker', looking_for: 'Nickel strip 0.15 mm', application: 'e-bike battery packs', cell_format: '18650', monthly_volume: '20 kg a month', urgency: 'within_a_month', ownerId: L.id }, L.id);
repo.addCustomer({ name: 'Volt Works', mobile: '98111 00002', company: 'Volt Works', city: 'Indore', buyer_type: 'trader', business: 'reseller_dealer', source: 'indiamart', looking_for: 'Copper busbar 55x20x2 mm', ownerId: V.id }, V.id);
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
repo.addVendor({ name: 'Saurav Metals', mobile: '90000 00001', company: 'Saurav Metals', city: 'Mumbai', notes: 'Usually has nickel strip in stock. Pays supplier credit 15 days.' }, L.id);
repo.addVendor({ name: 'Anil Traders', mobile: '90000 00002', city: 'Delhi' }, V.id);
repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 700, unit: 'kg', quantity: '200 kg', offerDate: day(-3) }, L.id);
repo.addOffer({ vendorMobile: '9000000001', itemId: 'p1', rate: 685, unit: 'kg', quantity: '150 kg', validTill: day(5) }, L.id);
repo.addOffer({ vendorMobile: '9000000002', itemId: 'p1', rate: 690, unit: 'kg', quantity: '500 kg' }, V.id);
repo.addOffer({ vendorMobile: '9000000001', itemText: 'Copper busbar 55x20x2', rate: 340, unit: 'pcs' }, L.id);
console.log('Demo data ready (members lokesh / vikas, password name-pass-1234)');
repo.close();
