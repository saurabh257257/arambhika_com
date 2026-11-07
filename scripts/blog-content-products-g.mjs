// Product-led posts, part G: cylindrical cells, chemistry and pack maths, and the first nickel-strip guides.
import { p, mk } from './blog-products-lib.mjs'

export const posts = [
  mk({
    slug: 'hongli-18650-nmc-cells-1200mah-1800mah-low-cost-uses',
    category: 'NMC Cylindrical Cells', tag: 'NMC Cells',
    title: 'Hongli 18650 NMC Cells (1200 and 1800 mAh): Where Lower-Capacity Cells Make Sense',
    short: ['Hongli 18650 1200 and 1800 mAh Cells', 'Low-cost cells for light-duty packs'],
    description: 'Where 1200 mAh and 1800 mAh Hongli 18650 NMC cells fit: small lights, speakers, repairs and low-drain products. Capacity maths and what to check on the datasheet. Live prices from Arambhika, Noida.',
    keywords: 'Hongli 18650, 1800mAh 18650 cell India, 1200mAh 18650, low cost lithium cell, 18650 for lights speakers',
    productsHeading: 'Hongli 18650 NMC cells',
    intro: 'Not every product needs the highest-capacity cell. Lower-capacity 18650s cost less and suit light-duty packs.',
    body: `
      <h2>The two cells</h2>
      <ul>
        <li><a href="${p('HONGLI 18650 NMC CELL 1800 mAh')}">Hongli 18650 NMC 1800 mAh</a></li>
        <li><a href="${p('HONGLI 18650 NMC CELL 1200 mAh')}">Hongli 18650 NMC 1200 mAh</a></li>
      </ul>
      <h2>Energy per cell</h2>
      <p>At about 3.6 V nominal, 1800 mAh is roughly 6.5 Wh and 1200 mAh roughly 4.3 Wh. Compare that with the 9.4 Wh of a <a href="${p('LITHIUM-ION CELL 2600 mAh DMEGC 18650')}">2600 mAh DMEGC cell</a>. For the same energy you need more of the smaller cells.</p>
      <h2>Good uses</h2>
      <ul>
        <li>Solar garden lights and small lamps.</li>
        <li>Portable speakers and radios.</li>
        <li>Rebuilding small packs where original capacity was low.</li>
        <li>Training, prototyping and test benches.</li>
      </ul>
      <h2>Poor uses</h2>
      <p>High-current tools and vehicles. For those, pick a cell whose datasheet states the discharge current you need, such as the <a href="${p('NORDA NMC CELL 18650 2600 mAh EV GRADE')}">EV grade 2600 mAh</a>.</p>
      <h2>Protect the pack</h2>
      <p>Use a small BMS like the <a href="${p('TDT NMC 3S-10AMP HARDWARE BMS')}">TDT 3S 10A</a>. Read the <a href="/blog/tdt-nmc-bms-1s-2s-3s-6s-small-lithium-ion-packs.html">small pack BMS guide</a>, and compare cells in the <a href="/blog/18650-vs-21700-nmc-cells-which-for-your-battery-pack.html">18650 vs 21700 guide</a>.</p>`,
    faq: [
      ['Can I mix 1200 and 1800 mAh cells?', 'No. Cells in one pack should match in model and capacity.'],
      ['Is lower capacity safer?', 'Capacity alone does not decide safety. Use a BMS, matched cells and correct charging.'],
      ['Can they replace 2600 mAh cells?', 'They fit physically, but runtime will be shorter and current limits may differ.'],
    ],
  }),

  mk({
    slug: '21700-4500mah-nmc-cells-dmegc-norda-longfeng-compared',
    category: 'NMC Cylindrical Cells', tag: 'NMC Cells',
    title: '21700 4500 mAh NMC Cells Compared: DMEGC, Norda and Longfeng',
    short: ['21700 4500 mAh Cells Compared', 'DMEGC, Norda and Longfeng side by side'],
    description: 'We stock three 21700 4500 mAh NMC cells: DMEGC, Norda and Longfeng. How to compare them on discharge rating, internal resistance, batches and price per Wh. Live prices from Arambhika.',
    keywords: 'DMEGC 21700 4500mAh, Norda 21700, Longfeng 21700, 21700 NMC cell India, 4500mAh cell comparison',
    productsHeading: '21700 4500 mAh NMC cells',
    intro: 'Same size, same capacity, different makers. The datasheet shows where they differ.',
    body: `
      <h2>The three cells</h2>
      <ul>
        <li><a href="${p('LITHIUM-ION CELL 4500 mAh DMEGC 21700')}">DMEGC 21700 4500 mAh</a></li>
        <li><a href="${p('NORDA NMC CELL 21700 4500 mAh')}">Norda 21700 4500 mAh</a></li>
        <li><a href="${p('LONGFENG 21700 NMC CELL 4500 mAh')}">Longfeng 21700 4500 mAh</a></li>
      </ul>
      <h2>What to compare</h2>
      <table class="blog-table">
        <thead><tr><th>Item</th><th>Look for</th></tr></thead>
        <tbody>
          <tr><td>Continuous discharge current</td><td>Needed amps per cell = pack peak current / cells in parallel</td></tr>
          <tr><td>Internal resistance</td><td>Lower reduces heat and voltage sag</td></tr>
          <tr><td>Batch consistency</td><td>Voltage and resistance across the batch</td></tr>
          <tr><td>Price per Wh</td><td>Live price divided by about 16.2 Wh</td></tr>
        </tbody>
      </table>
      <h2>Per-cell current example</h2>
      <p>A 13S4P e-bike pack drawing 40 A peak puts 10 A on each cell. Check the cell's rated continuous current is above that with a margin. If not, add parallel cells.</p>
      <h2>Buying advice</h2>
      <p>Choose one make and buy all the cells from one batch. Pair with <a href="${p('CELL HOLDER 21700 (1X2)')}">21700 holders</a> and <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 23 with holder with slit')}">2P strip</a>. Full build: <a href="/blog/build-13s-nmc-48v-battery-pack-21700-cells-step-by-step.html">13S 21700 pack</a>.</p>`,
    faq: [
      ['Which of the three is the best?', 'It depends on your current and budget. Compare datasheets, then choose by price per Wh and the discharge rating you need.'],
      ['Can I mix makers in one series string?', 'No. Keep all cells in a pack identical.'],
      ['How many cells for 1 kWh?', 'About 62 cells at 16.2 Wh each.'],
    ],
  }),

  mk({
    slug: 'lfp-32140-cylindrical-vs-prismatic-cells-which-format',
    category: 'LFP Cylindrical Cells,Prismatic Cells', tag: 'LFP Cells',
    title: 'LFP 32140 Cylindrical vs Prismatic Cells: Which Format Should You Build With?',
    short: ['LFP 32140 vs Prismatic Cells', 'Round or flat: pick the right LFP format'],
    description: 'Compare cylindrical 32140 LFP cells with large prismatic LFP cells on capacity, assembly, connections, cost and use cases to decide which format suits your battery pack. Cells at Arambhika.',
    keywords: 'cylindrical vs prismatic LFP, 32140 vs 314Ah, LFP cell format, small LFP pack, round LFP cells',
    productsHeading: 'LFP cylindrical and prismatic cells',
    intro: 'LFP comes in round cells and large flat cells. Each format suits different builds.',
    body: `
      <h2>Compare</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>32140 cylindrical (15Ah)</th><th>Prismatic (100Ah to 314Ah)</th></tr></thead>
        <tbody>
          <tr><td>Energy per cell</td><td>About 48 Wh</td><td>About 320 Wh to 1,000 Wh</td></tr>
          <tr><td>Cells for 5 kWh</td><td>About 105</td><td>About 5 to 16</td></tr>
          <tr><td>Connection</td><td>Spot-welded nickel strip</td><td>Bolted or laser-welded busbar</td></tr>
          <tr><td>Best for</td><td>Compact, custom shapes, small to mid packs</td><td>Storage and vehicles with simple layouts</td></tr>
        </tbody>
      </table>
      <h2>When cylindrical wins</h2>
      <ul>
        <li>Odd-shaped enclosures where you fit cells like tiles.</li>
        <li>Small packs where one prismatic cell would be too big.</li>
        <li>Teams with spot welding equipment.</li>
      </ul>
      <h2>When prismatic wins</h2>
      <ul>
        <li>Fewer cells and joints, so fewer places for faults.</li>
        <li>Large home storage and vehicle packs.</li>
        <li>Teams that prefer bolted assembly.</li>
      </ul>
      <h2>Examples</h2>
      <p>For round cells see <a href="${p('MOCEAN LFP CELL 3.2V 15AH 32140')}">Mocean 32140</a>; for flat ones the <a href="${p('GreatPower - 314Ah Prismatic Cell')}">GreatPower 314Ah</a>. Read the <a href="/blog/lfp-32140-cylindrical-cells-ess-ev-india-buying-guide.html">32140 guide</a> and <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah guide</a>.</p>`,
    faq: [
      ['Is 32140 safer than prismatic?', 'Format alone does not decide safety. Cell quality, BMS and build quality matter more.'],
      ['Which is cheaper per kWh?', 'Check live prices. Large prismatic cells are commonly cheaper per kWh.'],
      ['Can I use the same BMS?', 'Yes, if the series count and chemistry match.'],
    ],
  }),

  mk({
    slug: 'build-12v-60ah-lfp-pack-32140-cells-4s4p-step-by-step',
    category: 'LFP Cylindrical Cells,Nickel Strip Pure,BMS', tag: 'How-To',
    title: 'Build a 12.8V 60Ah LFP Pack from 32140 Cells (4S4P)',
    short: ['Build a 12.8V 60Ah 32140 Pack', '4S4P layout: 16 cells, strip and BMS'],
    description: 'Step-by-step 4S4P LFP battery with 16 32140 15Ah cells: 12.8V, 60Ah, about 768Wh. Cells, pure nickel strip, holders and 4S BMS parts list from Arambhika, Noida.',
    keywords: '4S4P LFP battery, 32140 battery pack build, 12V 60Ah LFP, LFP cylindrical pack DIY India, 32140 nickel strip',
    productsHeading: 'Parts for a 32140 LFP pack',
    readTime: 6,
    intro: 'Sixteen 32140 cells in a 4S4P layout make a 12.8 V, 60 Ah pack that fits a custom enclosure.',
    body: `
      <h2>The maths</h2>
      <p>4 in series at 3.2 V is 12.8 V. 4 in parallel at 15 Ah is 60 Ah. Energy is 12.8 x 60 = 768 Wh. At 12.8 V, a 300 W load draws about 23 A.</p>
      <h2>Parts</h2>
      <ul>
        <li>16 cells from one batch: <a href="${p('JSK LFP CELL 32140 15 Ah ESS AGRADE')}">JSK 32140 ESS A-grade</a> or <a href="${p('CBAK LFP CELL 32140 15 Ah EV')}">CBAK 32140 EV</a></li>
        <li>Holders: <a href="${p('CELL HOLDER 32650 (1X2)')}">32650 holders</a> if the size matches (check fit)</li>
        <li>Strip: <a href="${p('Nickel Strip Pure 2P(32650) 46.5x0.15 mm CD 34.5 with holder')}">pure 2P(32650) strip</a>, or <a href="${p('Nickel Strip Pure 2P(32650) 47x0.30 mm CD 34.5')}">47x0.30 mm</a> for higher current</li>
        <li>BMS: <a href="${p('DALY LFP 4S-100AMP HARDWARE BMS')}">Daly 4S hardware</a> or a <a href="${p('TDT LFP 4S-40AMP HARDWARE BMS')}">TDT 4S 40A</a></li>
      </ul>
      <h2>Steps</h2>
      <ol>
        <li>Match cell voltages and group them in four sets of four.</li>
        <li>Weld each set in parallel with strip, using test welds first.</li>
        <li>Join the four sets in series with strip or busbar.</li>
        <li>Wire the BMS using the <a href="/blog/bms-wiring-guide-balance-leads-main-cables-order-of-connection.html">wiring guide</a>.</li>
        <li>Insulate and test before use.</li>
      </ol>
      <h2>Notes</h2>
      <p>Spot-weld settings are in our <a href="/blog/spot-welding-lfp-32140-32650-cells-nickel-strip-settings-tips.html">LFP welding guide</a>. Check the strip against your current with the <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing guide</a>.</p>`,
    faq: [
      ['Is 4S4P the same as 16 cells?', 'Yes. Four groups in series, each with four cells in parallel.'],
      ['Will it run a 1000W inverter?', 'At 12.8 V that is about 78 A, which needs strong connections and a suitable BMS. Check cell ratings.'],
      ['Can I add more cells later?', 'Not safely mixed with old cells. Design for the capacity you need up front.'],
    ],
  }),

  mk({
    slug: 'nmc-vs-lfp-battery-chemistry-ebike-inverter-ev-india',
    category: 'NMC Cylindrical Cells,LFP Cylindrical Cells,Prismatic Cells', tag: 'Cells',
    title: 'NMC vs LFP Batteries: Which Chemistry for E-Bikes, Inverters and EVs in India?',
    short: ['NMC vs LFP: Which Chemistry?', 'Energy, life, safety and cost compared'],
    description: 'NMC or LFP for your battery? Compare energy density, cycle life, charging, temperature behaviour, cost and best uses for e-bikes, inverters, EVs and storage in India. Cells at Arambhika.',
    keywords: 'NMC vs LFP India, LFP or lithium ion battery, best chemistry for e-bike, LFP for inverter, battery chemistry guide',
    productsHeading: 'NMC and LFP cells',
    intro: 'The two chemistries behind most lithium packs trade energy for life and cost. Match the chemistry to the job.',
    body: `
      <h2>Side by side</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>NMC</th><th>LFP</th></tr></thead>
        <tbody>
          <tr><td>Nominal cell voltage</td><td>3.6 V</td><td>3.2 V</td></tr>
          <tr><td>Energy per weight</td><td>Higher</td><td>Lower</td></tr>
          <tr><td>Cycle life</td><td>Good</td><td>Typically longer</td></tr>
          <tr><td>Thermal stability</td><td>More sensitive</td><td>More tolerant</td></tr>
          <tr><td>Best for</td><td>Light, compact e-bikes and scooters</td><td>Inverters, storage, heavier vehicles</td></tr>
        </tbody>
      </table>
      <h2>Guide by use</h2>
      <ul>
        <li><strong>E-bike and light scooter:</strong> NMC, such as <a href="${p('NORDA NMC CELL 21700 4500 mAh')}">21700</a> cells, for the best range per kilo.</li>
        <li><strong>Home inverter and solar storage:</strong> LFP, for life and heat tolerance; see <a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">314Ah cells</a>.</li>
        <li><strong>E-rickshaw and cargo:</strong> LFP for daily deep cycling.</li>
        <li><strong>Small gadgets:</strong> NMC 18650.</li>
      </ul>
      <h2>Different BMS, different charger</h2>
      <p>The chemistries have different voltage limits. Always use a BMS and charger made for your chemistry. See the <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">series count table</a> and our <a href="/blog/lfp-battery-pack-solar-inverter-nickel-strip-busbar-india.html">LFP solar guide</a>.</p>`,
    faq: [
      ['Which is safer, NMC or LFP?', 'LFP is generally more thermally stable, but both are safe when well built with the right BMS and charger.'],
      ['Which is lighter for the same energy?', 'NMC, because its cells store more energy per kilo.'],
      ['Can I swap chemistries in a pack?', 'Not without changing the BMS and charger. Their voltage ranges differ.'],
    ],
  }),

  mk({
    slug: 'series-and-parallel-explained-battery-pack-maths-13s4p-16s-india',
    category: 'NMC Cylindrical Cells,Nickel Strip Plated', tag: 'Basics',
    title: 'Series and Parallel Explained: The Battery Pack Maths Behind 13S4P and 16S',
    short: ['Series and Parallel Explained', 'The simple maths behind every pack label'],
    description: 'Learn what S and P mean in battery packs (13S4P, 16S1P), how to calculate voltage, capacity and energy, and how to plan cell counts for e-bikes, inverters and storage. Parts from Arambhika.',
    keywords: 'series parallel battery explained, 13S4P meaning, battery pack voltage capacity calculation, XSYP battery, how many cells needed',
    productsHeading: 'Cells and strip for any layout',
    intro: 'Every pack label hides a bit of arithmetic. Once you know it, you can design any battery.',
    body: `
      <h2>The rules</h2>
      <ul>
        <li><strong>Series (S)</strong> adds voltage. Capacity stays the same.</li>
        <li><strong>Parallel (P)</strong> adds capacity. Voltage stays the same.</li>
      </ul>
      <p>So a 13S4P pack of 4.5 Ah cells has 13 x 3.6 = 46.8 V and 4 x 4.5 = 18 Ah. Energy is voltage times capacity: 46.8 x 18 = 842 Wh. Cells needed: 13 x 4 = 52.</p>
      <h2>Worked examples</h2>
      <table class="blog-table">
        <thead><tr><th>Layout</th><th>Cell</th><th>Voltage</th><th>Capacity</th><th>Energy</th></tr></thead>
        <tbody>
          <tr><td>13S4P</td><td>NMC 21700 4.5Ah</td><td>46.8 V</td><td>18 Ah</td><td>842 Wh</td></tr>
          <tr><td>16S1P</td><td>LFP 314Ah</td><td>51.2 V</td><td>314 Ah</td><td>16,077 Wh</td></tr>
          <tr><td>4S4P</td><td>LFP 32140 15Ah</td><td>12.8 V</td><td>60 Ah</td><td>768 Wh</td></tr>
          <tr><td>20S2P</td><td>NMC 18650 2.6Ah</td><td>72 V</td><td>5.2 Ah</td><td>374 Wh</td></tr>
        </tbody>
      </table>
      <h2>Working backwards</h2>
      <ol>
        <li>Choose the voltage the motor or inverter needs, which fixes S.</li>
        <li>Choose the energy you want, divide by voltage to get Ah.</li>
        <li>Divide by the cell's Ah to get P.</li>
        <li>Check current per cell against its rating.</li>
      </ol>
      <h2>Connect it</h2>
      <p>Spot-welded packs link cells with strip such as <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 with holder with slit')}">2P strip</a>; prismatic packs use <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">busbar</a>. Cells: <a href="${p('NORDA NMC CELL 21700 4500 mAh')}">Norda 21700</a>. See the <a href="/blog/build-13s-nmc-48v-battery-pack-21700-cells-step-by-step.html">13S4P build</a>.</p>`,
    faq: [
      ['What does 16S1P mean?', '16 cells in series with one cell per group, so one string of 16.'],
      ['Does adding parallel cells increase voltage?', 'No. Parallel cells increase capacity and current capability, not voltage.'],
      ['How do I find the cells needed?', 'Multiply S by P. A 13S4P pack needs 52 cells.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-plated-2p-18650-26mm-cd19-pack-guide',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Nickel Strip 2P for 18650 Cells (26 mm, CD 19): Plated, Pure and Slit Options',
    short: ['2P Nickel Strip for 18650 Cells', 'The 26 mm CD 19 strip and its variants'],
    description: 'Choose the right 2P nickel strip for 18650 packs: plated CD 19, plated without slit, pure and zig-zag versions at 26 mm width. Where each fits, with live prices from Arambhika, Noida.',
    keywords: '2P nickel strip 18650, 26x0.15 nickel strip, 18650 strip CD 19, nickel strip without slit, 18650 pack strip India',
    productsHeading: '2P nickel strip for 18650',
    intro: '18650 packs are the oldest and most common pack format. A 2P strip makes assembly fast and tidy.',
    body: `
      <h2>The variants</h2>
      <table class="blog-table">
        <thead><tr><th>Strip</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Nickel Strip Plated 2P(18650) 26x0.15 mm CD 19')}">Plated 26x0.15 mm CD 19</a></td><td>The standard choice; centre distance 19 mm</td></tr>
          <tr><td><a href="${p('Nickel Strip Plated 2P(18650) 26x0.15 mm without slit')}">Plated 26x0.15 mm without slit</a></td><td>Plain strip with no slit cut</td></tr>
          <tr><td><a href="${p('Nickel Strip Pure 2P(18650) 26x0.15 mm')}">Pure 26x0.15 mm</a></td><td>Higher conductivity for heavier loads</td></tr>
          <tr><td><a href="${p('Nickel Strip Pure 2P(18650) Zig Zag 26x0.30 mm')}">Pure zig-zag 26x0.30 mm</a></td><td>Thicker, formed shape for high-current layouts</td></tr>
        </tbody>
      </table>
      <h2>How to choose</h2>
      <ul>
        <li>Light and moderate loads, cost first: plated.</li>
        <li>High current or long life: pure, and thicker if your welder can manage it.</li>
        <li>Unusual layouts: ask about the zig-zag.</li>
      </ul>
      <h2>Fit and holders</h2>
      <p>CD 19 matches an 18650 packed with a small gap. Use <a href="${p('CELL HOLDER 18650 (1X2)')}">18650 holders</a> to hold that spacing. See the <a href="/blog/nickel-strip-centre-distance-cd-explained-match-strip-to-cell.html">CD guide</a>.</p>
      <h2>Weld tips</h2>
      <p>Run test welds on scrap cells and do a pull test. Our <a href="/blog/spot-weld-nickel-strip-18650-21700-battery-pack-guide.html">spot-welding guide</a> covers the settings.</p>`,
    faq: [
      ['What does 26x0.15 mean?', 'The strip is 26 mm wide and 0.15 mm thick.'],
      ['Is pure strip worth the extra cost?', 'For high-current packs, yes. For light loads plated is usually enough.'],
      ['Can I cut 2P strip into 1P?', 'It can be cut, but the 2P form is designed to join two cells together as made.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-pure-2p-21700-cd-22-5-vs-cd-23-holder-choice',
    category: 'Nickel Strip Pure,Nickel Strip Plated', tag: 'Nickel Strip',
    title: 'Pure Nickel 2P Strip for 21700 Cells: CD 22.5 vs CD 23 and Choosing a Holder',
    short: ['Pure Nickel 2P Strip for 21700', 'CD 22.5 vs CD 23, and plated alternatives'],
    description: 'Pure and plated 2P nickel strip for 21700 cells in CD 22.5 and CD 23, with and without holders. How to pick the spacing, what a slit changes and when pure nickel is worth it. Live prices from Arambhika.',
    keywords: '21700 nickel strip, 2P 21700 strip CD 22.5, CD 23 nickel strip, pure nickel 21700 strip, 21700 strip with holder',
    productsHeading: '2P nickel strip for 21700',
    intro: 'Two spacings (22.5 and 23) and both plated and pure versions make the 21700 range wide. Here is how to pick.',
    body: `
      <h2>The line-up</h2>
      <table class="blog-table">
        <thead><tr><th>Material</th><th>CD 22.5</th><th>CD 23</th></tr></thead>
        <tbody>
          <tr><td>Pure, with holder</td><td><a href="${p('Nickel Strip Pure 2P(21700) 31x0.15 mm CD 22.5 with holder')}">31x0.15 mm</a></td><td><a href="${p('Nickel Strip Pure 2P(21700) 31x0.15 mm CD 23 with holder')}">31x0.15 mm</a></td></tr>
          <tr><td>Plated, with holder</td><td><a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 with holder with slit')}">31x0.15 mm, slit</a></td><td><a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 23 with holder with slit')}">31x0.15 mm, slit</a></td></tr>
          <tr><td>Plated, without holder</td><td><a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 without holder with slit')}">with slit</a></td><td><a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 23 without holder without slit')}">without slit</a></td></tr>
        </tbody>
      </table>
      <h2>Which CD?</h2>
      <p>Measure the centre-to-centre spacing in your layout or holder. A 21700 is about 21 mm wide, so a CD of 22.5 is a tight pack and 23 leaves a little more gap. The strip must match, otherwise weld points miss the terminal.</p>
      <h2>Pure or plated</h2>
      <p>Pure nickel conducts better so it runs cooler at the same size. It costs more per kg. Use pure for fast chargers, high-power builds and long-life packs; plated for ordinary use.</p>
      <h2>Next</h2>
      <p>Read the <a href="/blog/nickel-strip-types-slit-fuse-type-zig-zag-explained.html">strip type guide</a>, and the <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">holder guide</a>. Use <a href="${p('CELL HOLDER 21700 (1X2)')}">21700 holders</a> for repeatable spacing.</p>`,
    faq: [
      ['Does CD 23 fit a CD 22.5 holder?', 'Not reliably. Match the strip to the holder spacing.'],
      ['Is "with holder" strip only for holders?', 'It is made for holder-based layouts. Use it with the matching holder.'],
      ['Can I weld pure nickel with a small welder?', 'Pure nickel conducts heat and current well, which can make welding need more energy than plated. Test welds first.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-32650-2p-46-5-47-49-5mm-width-and-thickness-guide',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Nickel Strip for 32650 Cells: 46.5, 47 and 49.5 mm Widths and Thickness Choices',
    short: ['Nickel Strip for 32650 Cells', 'Widths 46.5 to 49.5 mm, 0.15 to 0.30 mm thick'],
    description: 'Navigate the 32650 nickel strip range: 46.5, 47 and 49.5 mm widths, 0.15, 0.20 and 0.30 mm thickness, CD 32.8 vs 34.5, with or without holder and slit. Live prices from Arambhika, Noida.',
    keywords: '32650 nickel strip, 32650 2P strip 46.5mm, 47x0.30 nickel strip, 49.5x0.20 pure nickel strip, 32140 LFP strip',
    productsHeading: '2P nickel strip for 32650',
    intro: '32650 and 32140 LFP cells are wide, so their strip is wide too. This range has the most variants of any cell size.',
    body: `
      <h2>Reading the range</h2>
      <ul>
        <li><strong>Width 46.5 mm:</strong> <a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.15 mm CD 34.5 with holder with slit')}">plated 0.15</a>, <a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.20 mm CD 34.5 with holder with slit')}">plated 0.20</a>, <a href="${p('Nickel Strip Pure 2P(32650) 46.5x0.15 mm CD 34.5 with holder')}">pure 0.15</a></li>
        <li><strong>Width 47 mm:</strong> <a href="${p('Nickel Strip Plated 2P(32650) 47x0.30 mm CD 32.8 without holder without slit')}">plated 0.30</a>, <a href="${p('Nickel Strip Pure 2P(32650) 47x0.20 mm CD 34.5 with holder')}">pure 0.20</a>, <a href="${p('Nickel Strip Pure 2P(32650) 47x0.30 mm CD 34.5')}">pure 0.30</a></li>
        <li><strong>Width 49.5 mm:</strong> <a href="${p('Nickel Strip Pure 2P(32650) 49.5x0.20 mm CD 34.5 with holder')}">pure 0.20</a></li>
      </ul>
      <h2>CD 32.8 vs 34.5</h2>
      <p>32.8 suits cells packed tight without a holder; 34.5 suits cells spaced by a holder. Measure your layout first. See the <a href="/blog/nickel-strip-centre-distance-cd-explained-match-strip-to-cell.html">CD guide</a>.</p>
      <h2>Choosing thickness</h2>
      <p>0.15 mm for light loads, 0.20 mm for most storage packs, 0.30 mm for high current if your welder can weld it. Use the <a href="/blog/nickel-strip-thickness-0-15-0-20-0-30-mm-choose-for-current.html">thickness guide</a> and the <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing guide</a>.</p>
      <h2>Your cells</h2>
      <p>These strips connect <a href="${p('JSK LFP CELL 32140 15 Ah ESS AGRADE')}">32140</a> and 32650 LFP cells. Use <a href="${p('CELL HOLDER 32650 (1X2)')}">32650 holders</a> where the layout calls for them.</p>`,
    faq: [
      ['Why so many variants?', 'Different cell makers, holders and current needs call for different widths, spacing and thickness.'],
      ['Which is best for a 15Ah 32140 pack?', 'Match the spacing and use the thickness your current and welder allow; message us your layout.'],
      ['Is 0.30 mm hard to weld?', 'It needs a stronger welder than 0.15 mm. Test before ordering a large quantity.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-1p-6mm-8mm-10mm-width-choose-for-cells-and-current',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Choosing 1P Nickel Strip Width: 6, 8 or 10 mm for Your Cells and Current',
    short: ['1P Nickel Strip: 6, 8 or 10 mm?', 'Width, thickness and current in one table'],
    description: 'Pick the right 1P nickel strip width (6, 8 or 10 mm) and thickness for 18650, 21700 and custom packs. Cross-section maths, welding room and plated vs pure. Live prices from Arambhika, Noida.',
    keywords: '1P nickel strip 8mm, 10x0.15 nickel strip, 6mm nickel strip, nickel strip width choice, plain nickel strip India',
    productsHeading: '1P nickel strip in 6, 8 and 10 mm',
    intro: 'Plain 1P strip is the most flexible option. Three widths and several thicknesses cover most hand-built packs.',
    body: `
      <h2>Cross-section</h2>
      <p>Cross-section is width times thickness. It decides how much current the strip carries.</p>
      <table class="blog-table">
        <thead><tr><th>Strip</th><th>Cross-section</th><th>Plated</th><th>Pure</th></tr></thead>
        <tbody>
          <tr><td>6 x 0.15</td><td>0.90 mm²</td><td><a href="${p('Nickel Strip Plated 1P 6x0.15 mm')}">link</a></td><td><a href="${p('Nickel Strip Pure 1P 6x0.15 mm')}">link</a></td></tr>
          <tr><td>8 x 0.15</td><td>1.20 mm²</td><td><a href="${p('Nickel Strip Plated 1P 8x0.15 mm')}">link</a></td><td><a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">link</a></td></tr>
          <tr><td>10 x 0.15</td><td>1.50 mm²</td><td><a href="${p('Nickel Strip Plated 1P 10x0.15 mm')}">link</a></td><td><a href="${p('Nickel Strip Pure 1P 10x0.15 mm')}">link</a></td></tr>
          <tr><td>8 x 0.30</td><td>2.40 mm²</td><td><a href="${p('Nickel Strip Plated 1P 8x0.30 mm')}">link</a></td><td><a href="${p('Nickel Strip Pure 1P 8x0.30 mm')}">link</a></td></tr>
        </tbody>
      </table>
      <h2>Width and the cell</h2>
      <p>A 18650 terminal can fit a 8 mm or 10 mm strip with room for two weld spots side by side. 6 mm is tight and best for single spots or small cells. Wider is not always better if it covers the vent area of the cell.</p>
      <h2>Rules of thumb</h2>
      <ul>
        <li>Choose the strip so that each cell's current passes through enough cross-section.</li>
        <li>Parallel groups carry the sum of their cells' current, so strip between groups needs more.</li>
        <li>Use pure nickel to get more current from a given size.</li>
      </ul>
      <p>For worked examples see the <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing guide</a>, and for plated vs pure the <a href="/blog/nickel-strip-price-per-kg-india-plated-vs-pure.html">price guide</a>.</p>`,
    faq: [
      ['Which width is best for 18650?', 'Many builders use 8 mm or 10 mm. Pick by the current and the weld spot layout.'],
      ['Can I use 1P strip for 21700?', 'Yes. The same widths fit, and thicker strip may be needed for more current.'],
      ['Is thicker or wider better?', 'Both raise cross-section. Thicker needs a stronger welder; wider needs room on the terminal.'],
    ],
  }),
]
