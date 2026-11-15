// Local preview only: fills a data folder with a few made-up members and customers so the pages have something to show.
// Usage: node scripts/seed-demo.js <data folder>      (never run this against real data)
'use strict';
const path = require('path');
const { open } = require('../lib/db');

const dir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Give a data folder: node scripts/seed-demo.js ./demo-data'); process.exit(1); }
const repo = open(dir);
const L = repo.createMember({ name: 'Lokesh', username: 'lokesh', password: 'lokesh-pass-1234' }).member;
const V = repo.createMember({ name: 'Vikas', username: 'vikas', password: 'vikas-pass-1234' }).member;
const c1 = repo.addCustomer({ name: 'Shakti Batteries', company: 'Shakti Batteries Pvt Ltd', phone: '9811100001', city: 'Pune', ownerId: L.id }, L.id).customer;
const c2 = repo.addCustomer({ name: 'Volt Works', company: 'Volt Works', phone: '9811100002', city: 'Indore', ownerId: V.id }, V.id).customer;
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
repo.addInteraction({ customerId: c1.id, type: 'call', summary: 'First call. Interested in nickel strip 0.15 mm, about 20 kg a month.', nextDate: day(3) }, L.id);
repo.addInteraction({ customerId: c1.id, type: 'quote', summary: 'Sent quote on WhatsApp: nickel strip 20 kg at Rs 750 a kg.', amount: 15000 }, L.id);
repo.addInteraction({ customerId: c1.id, type: 'order', summary: 'Confirmed the order, wants delivery by Friday.', amount: 15000 }, L.id);
repo.addInteraction({ customerId: c1.id, type: 'payment', summary: 'Payment received by UPI.', amount: 15000 }, V.id);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
repo.addFile({ customerId: c1.id, name: 'payment-screenshot.png', mime: 'image/png', buffer: png }, V.id);
repo.addInteraction({ customerId: c2.id, type: 'whatsapp', summary: 'Asked for copper busbar 55x20x2 mm price.', nextDate: day(1) }, V.id);
console.log('Demo data ready in', dir, '(members lokesh / vikas, password name-pass-1234)');
repo.close();
