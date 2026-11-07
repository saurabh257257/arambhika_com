// Product-led posts, part F: BMS how-tos and prismatic LFP cells.
import { p, mk } from './blog-products-lib.mjs'

export const posts = [
  mk({
    slug: 'bms-for-electric-bicycle-10s-13s-14s-nmc-choose-board',
    category: 'BMS,NMC Cylindrical Cells', tag: 'BMS Guide',
    title: 'Choosing a BMS for an Electric Bicycle: 10S, 13S and 14S NMC Packs',
    short: ['BMS for Electric Bicycles', '36V, 48V and 52V packs matched to a board'],
    description: 'Match a BMS to an e-bike battery: 10S (36V), 13S (48V) and 14S (52V) NMC, with current ratings and Daly, JBD options. Controller limits and cell choice explained. Live prices from Arambhika.',
    keywords: 'BMS for e-bike, 14S BMS 52V, 10S 36V e-bike BMS, 13S BMS India, electric bicycle battery BMS',
    productsHeading: 'BMS boards for e-bike batteries',
    intro: 'E-bikes use three common pack sizes. Each has a matching series count, and the right BMS follows from it.',
    body: `
      <h2>Pack and BMS</h2>
      <table class="blog-table">
        <thead><tr><th>Pack</th><th>Series</th><th>Example board</th></tr></thead>
        <tbody>
          <tr><td>36 V</td><td>10S</td><td><a href="${p('JBD NMC 10S-20AMP HARDWARE BMS')}">JBD NMC 10S 20A</a></td></tr>
          <tr><td>48 V</td><td>13S</td><td><a href="${p('DALY NMC 13S-40AMP SMART BMS')}">Daly NMC 13S 40A smart</a></td></tr>
          <tr><td>52 V</td><td>14S</td><td><a href="${p('DALY NMC 14S-60AMP HARDWARE BMS')}">Daly NMC 14S 60A hardware</a></td></tr>
        </tbody>
      </table>
      <h2>Read your controller</h2>
      <p>The controller label or manual gives a battery current limit. Choose a BMS whose continuous rating is at or above it, and whose cutoff voltages match the pack. For 36 V packs that limit is often 15 A to 20 A; for 48 V and 52 V packs it is commonly 25 A to 40 A.</p>
      <h2>Hardware or smart?</h2>
      <p>A hardware board is cheapest and easy to fit. A smart one lets you see cell voltages over Bluetooth, which helps when range drops. See the <a href="/blog/daly-nmc-13s-bms-40a-vs-60a-48v-e-bike-battery.html">13S guide</a>.</p>
      <h2>Cells</h2>
      <p>Use matched cells such as the <a href="${p('NORDA NMC CELL 18650 2600 mAh EV GRADE')}">Norda 18650</a> or <a href="${p('LITHIUM-ION CELL 4500 mAh DMEGC 21700')}">DMEGC 21700</a>, joined with <a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">nickel strip</a>.</p>`,
    faq: [
      ['What is a 14S pack in volts?', 'About 51.8 V nominal and 58.8 V fully charged, sold as a 52 V pack.'],
      ['Can the BMS be smaller than the controller limit?', 'No. A BMS rated below the controller current will trip under load.'],
      ['Where do I fit the BMS in a frame battery?', 'Keep it where air can reach it and away from the cells it could heat.'],
    ],
  }),

  mk({
    slug: 'bms-wiring-guide-balance-leads-main-cables-order-of-connection',
    category: 'BMS,Copper Bus Bar', tag: 'How-To',
    title: 'How to Wire a BMS: Balance Leads, Main Cables and the Right Order of Connection',
    short: ['How to Wire a BMS Correctly', 'Balance leads first, main cables last'],
    description: 'A step-by-step BMS wiring guide for lithium packs: identify cell taps, check voltages at the plug, connect balance leads in order, then the main cable. Common mistakes. Parts from Arambhika.',
    keywords: 'how to wire BMS, BMS balance lead order, BMS wiring diagram, lithium battery BMS installation, BMS B- P- C-',
    productsHeading: 'BMS and busbar for your build',
    intro: 'Most BMS failures on new builds come from wiring mistakes, not faulty boards. A careful order of work avoids them.',
    body: `
      <h2>Before you start</h2>
      <ul>
        <li>Read the manual for your exact board; wiring varies by model.</li>
        <li>Make sure the cells are already joined in series and parallel and that total voltage is as expected.</li>
        <li>Remove rings and use insulated tools.</li>
      </ul>
      <h2>Step by step</h2>
      <ol>
        <li><strong>Identify the taps.</strong> The balance wire harness has one wire at the pack negative, then one after each series group, ending at the pack positive.</li>
        <li><strong>Measure before plugging.</strong> With a multimeter, check each tap in turn against the lowest tap. The voltage should step up by one cell voltage (about 3.2 V for LFP, 3.6 V for NMC) at each wire.</li>
        <li><strong>Connect the balance plug.</strong> Plug in the harness only after the check passes.</li>
        <li><strong>Connect the main negative.</strong> From the pack negative (B-) to the BMS, following the diagram.</li>
        <li><strong>Test outputs.</strong> Check voltage on the output terminals before attaching a load.</li>
        <li><strong>Attach the load and charger</strong> only after the board shows normal cell readings.</li>
      </ol>
      <h2>Common mistakes</h2>
      <ul>
        <li>Wires in the wrong order, which can destroy the board.</li>
        <li>Thin main cable, causing heat; use copper sized for the current, such as <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">copper busbar</a> for short links.</li>
        <li>Missing fuse on the main positive.</li>
      </ul>
      <h2>Boards to practise on</h2>
      <p>A <a href="${p('DALY LFP 4S-100AMP SMART BMS')}">4S smart BMS</a> is a simple first board, and the app shows you at once if a cell is wired wrongly.</p>`,
    faq: [
      ['What do B-, P- and C- mean?', 'Labels differ by board. Typically B- goes to the pack negative, P- to the load and C- to the charger on a separate-port board. Check your manual.'],
      ['Can I plug the balance lead in live?', 'Do the voltage check first and connect only if everything is right. Following the manual order reduces risk.'],
      ['Do I need a fuse if there is a BMS?', 'Yes. The BMS does not replace a correctly rated fuse or breaker.'],
    ],
  }),

  mk({
    slug: 'highstar-314ah-laser-weld-vs-with-packing-cell-variants',
    category: 'Prismatic Cells', tag: 'LFP Cells',
    title: 'Highstar 314Ah LFP Cells: Laser Weld, With Packing and Standard Variants',
    short: ['Highstar 314Ah Cell Variants', 'Three listings, what each one is'],
    description: 'Highstar sells 314Ah LFP cells in more than one form. Learn what laser-welded and with-packing variants mean for your build, and how to pick. Live prices from Arambhika, Noida.',
    keywords: 'Highstar 314Ah, Highstar LFP cell India, 314Ah laser welding, 314Ah with packing, 3.2V 314Ah cell',
    productsHeading: 'Highstar LFP cells',
    intro: 'Three Highstar 314Ah listings can look alike. The differences affect how you connect and transport the cells.',
    body: `
      <h2>The listings</h2>
      <ul>
        <li><a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">Highstar 314Ah 3.2V prismatic cell</a></li>
        <li><a href="${p('Highstar LFP Cell 3.2V 314Ah with Packing')}">Highstar LFP cell 314Ah with packing</a></li>
        <li><a href="${p('Highstar LFP Cell 3.2V 314Ah Laser Welding')}">Highstar LFP cell 314Ah laser welding</a></li>
      </ul>
      <h2>What the words mean</h2>
      <p><strong>Laser welding</strong> refers to terminals prepared for laser-welded busbars. Pack builders with a laser welder use this for low-resistance, compact joints. The other types use bolted terminals. <strong>With packing</strong> means the cells ship in protective packaging suited to transport and storage. Confirm the exact terminal type and what is included on the product page.</p>
      <h2>Choose by your assembly method</h2>
      <table class="blog-table">
        <thead><tr><th>Method</th><th>Cell type to look for</th></tr></thead>
        <tbody>
          <tr><td>Bolted busbar, no special tools</td><td>Standard prismatic with bolt terminals</td></tr>
          <tr><td>Laser-welded busbars</td><td>Laser-weld variant</td></tr>
        </tbody>
      </table>
      <h2>Next steps</h2>
      <p>The maths for a 16S 314Ah battery is in the <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">storage build guide</a>, and buying checks are in the <a href="/blog/buying-lfp-prismatic-cells-india-checklist-matching-grade-testing.html">cell buying checklist</a>.</p>`,
    faq: [
      ['Can I bolt a laser-weld cell?', 'Check the terminal design for that listing. Laser-weld cells are intended for welded connections.'],
      ['Are all 314Ah cells the same size?', 'They are similar but not always identical. Check dimensions before designing a case.'],
      ['Which is cheapest?', 'Prices differ by variant and change often; the product pages show the live price.'],
    ],
  }),

  mk({
    slug: 'ganfeng-150ah-206ah-314ah-laser-weld-prismatic-cells-guide',
    category: 'Prismatic Cells', tag: 'LFP Cells',
    title: 'Ganfeng 150Ah, 206Ah and 314Ah Laser Weld Prismatic Cells: Which Size for Which Job?',
    short: ['Ganfeng 150Ah, 206Ah, 314Ah Cells', 'Pick the capacity for home, UPS or large storage'],
    description: 'Compare Ganfeng laser-weld prismatic LFP cells in 150Ah, 206Ah and 314Ah: energy in a 16S pack, uses and what laser weld terminals mean. Live prices from Arambhika, Noida.',
    keywords: 'Ganfeng 314Ah, Ganfeng 206Ah, Ganfeng 150Ah, laser weld LFP cell India, 16S energy storage cells',
    productsHeading: 'Ganfeng laser weld cells',
    intro: 'Ganfeng cells in three capacities give a ladder of storage sizes. All three are laser-weld versions.',
    body: `
      <h2>Energy in a 16S (51.2 V) pack</h2>
      <table class="blog-table">
        <thead><tr><th>Cell</th><th>Capacity</th><th>16S energy (nominal)</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Ganfeng - 150Ah Laser Weld Prismatic Cell')}">Ganfeng 150Ah</a></td><td>150 Ah</td><td>about 7.7 kWh</td></tr>
          <tr><td><a href="${p('Ganfeng - 206Ah Laser Weld Prismatic Cell')}">Ganfeng 206Ah</a></td><td>206 Ah</td><td>about 10.5 kWh</td></tr>
          <tr><td><a href="${p('Ganfeng - 314Ah Laser Weld Prismatic Cell')}">Ganfeng 314Ah</a></td><td>314 Ah</td><td>about 16.1 kWh</td></tr>
        </tbody>
      </table>
      <h2>How to choose</h2>
      <ul>
        <li><strong>150Ah:</strong> compact packs, small homes, 24 V to 48 V UPS.</li>
        <li><strong>206Ah:</strong> a middle size for typical home backup.</li>
        <li><strong>314Ah:</strong> the largest, for big storage and commercial use.</li>
      </ul>
      <h2>Laser weld terminals</h2>
      <p>These cells are designed for laser-welded busbar connections. If you do not have laser welding capability, a bolted-terminal cell may be easier; ask us. For the pack design see our <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah build</a>, and for sizing the BMS use the <a href="/blog/daly-ess-15s-new-model-vs-active-balancing-which-to-choose.html">ESS BMS guide</a>.</p>`,
    faq: [
      ['What is the size difference between 206Ah and 314Ah?', 'They differ in dimensions; check the listing and datasheet before designing the enclosure.'],
      ['Is 206Ah a good middle option?', 'It suits many home systems that need more than 150Ah but not the size of 314Ah.'],
      ['Can I mix capacities in a pack?', 'No. Cells in a series string should be identical in model and capacity.'],
    ],
  }),

  mk({
    slug: 'calb-280ah-vs-314ah-lfp-cell-home-energy-storage-comparison',
    category: 'Prismatic Cells', tag: 'LFP Cells',
    title: 'CALB 280Ah vs 314Ah LFP Cells: Which Is Better for Home Energy Storage?',
    short: ['CALB 280Ah vs 314Ah LFP Cells', 'Energy, cost and planning compared'],
    description: 'Compare 280Ah and 314Ah prismatic LFP cells for home storage: kWh per 16S pack, price per kWh using live listings, space and BMS needs. CALB and 314Ah options from Arambhika.',
    keywords: 'CALB 280Ah, 280Ah vs 314Ah, LFP cell comparison, home energy storage cells India, 16S 280Ah',
    productsHeading: '280Ah and 314Ah prismatic cells',
    intro: 'The two most common storage cell sizes differ by about 12% in capacity. Which one wins depends on price and space.',
    body: `
      <h2>Energy side by side</h2>
      <p>For a 16S pack at 51.2 V: 280Ah gives about 14.3 kWh and 314Ah about 16.1 kWh. The <a href="${p('CALB 3.2V - 280Ah Prismatic Cell')}">CALB 280Ah</a> and the <a href="${p('GreatPower - 314Ah Prismatic Cell')}">GreatPower 314Ah</a> are two examples we list.</p>
      <h2>Compare price per kWh, not per cell</h2>
      <p>Take the live price of each cell, divide by its energy (3.2 V x Ah / 1000 gives kWh per cell). For example, a 280Ah cell stores about 0.9 kWh and a 314Ah about 1.0 kWh. The cheaper one per kWh is the better buy on cost alone.</p>
      <h2>Other factors</h2>
      <ul>
        <li><strong>Space:</strong> check cell dimensions against your enclosure; the two sizes are close but not always the same.</li>
        <li><strong>Terminal type:</strong> some are bolted, some laser-weld.</li>
        <li><strong>BMS and busbar:</strong> same series count, same BMS; the busbar must fit the terminal spacing.</li>
      </ul>
      <h2>Our suggestion</h2>
      <p>If the price per kWh is similar, 314Ah gives more energy for the same number of connections, which usually means less wiring and fewer joints. Read the <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">full 314Ah build</a>, and our <a href="/blog/highstar-314ah-laser-weld-vs-with-packing-cell-variants.html">Highstar variant guide</a>.</p>`,
    faq: [
      ['Is 314Ah a newer standard than 280Ah?', 'Both are widely used. 314Ah has become the more common choice for new storage designs.'],
      ['Do the two share a BMS?', 'Yes, since both are 3.2 V cells, a BMS for your series count works with either.'],
      ['Which lasts longer?', 'Cycle life depends on the cell model and how you use it. Compare the datasheet figures.'],
    ],
  }),

  mk({
    slug: 'greatpower-230ah-prismatic-cell-24v-8s-lfp-battery-build',
    category: 'Prismatic Cells,BMS', tag: 'How-To',
    title: 'GreatPower 230Ah Prismatic Cell: Build a 24V 8S LFP Battery (About 5.9 kWh)',
    short: ['Build a 24V 230Ah LFP Battery', '8S x 230Ah, BMS and busbar parts list'],
    description: 'Build a 25.6V 230Ah LFP battery (about 5.9 kWh) from eight GreatPower 230Ah cells: capacity maths, BMS, busbar and assembly. Parts from Arambhika, Noida.',
    keywords: 'GreatPower 230Ah, 24V LFP battery build, 8S 230Ah, 5.9 kWh LFP battery, 24V inverter lithium battery India',
    productsHeading: 'Parts for a 24V 230Ah pack',
    readTime: 6,
    intro: 'Eight 230Ah cells make a 25.6 V battery of about 5.9 kWh, a good size for a 24 V inverter that serves a small home.',
    body: `
      <h2>The maths</h2>
      <p>8 x 3.2 V = 25.6 V. Energy is 25.6 V x 230 Ah = 5,888 Wh, about 5.9 kWh nominal. A 2 kVA inverter at 25.6 V draws about 78 A, so a 100 A BMS gives headroom.</p>
      <h2>Parts list</h2>
      <ul>
        <li>8 cells: <a href="${p('GreatPower 3.2V - 230Ah Prismatic Cell')}">GreatPower 230Ah</a>, same batch</li>
        <li>BMS: <a href="${p('DALY LFP 8S-100AMP HARDWARE BMS')}">Daly 8S 100A hardware</a> or <a href="${p('JBD LFP 8S-24S - 100Amp SMART BMS')}">JBD 8S-24S 100A smart</a></li>
        <li>Busbar: <a href="${p('COPPER BUS BAR Universal (68x20x2mm)- Tin Coated')}">copper bars</a> or <a href="${p('Aluminium Busbar Model 1 C2C Series')}">aluminium C2C series bars</a></li>
        <li>Insulation: <a href="${p('EPOXY SHEET (502*338*1MM)')}">epoxy sheet</a>, plus fuse and enclosure</li>
      </ul>
      <h2>Build steps</h2>
      <ol>
        <li>Measure and match cell voltages; parallel-balance them.</li>
        <li>Stack with the recommended compression, with insulation where needed.</li>
        <li>Join cells in series and torque the bolts evenly.</li>
        <li>Wire the BMS; follow the <a href="/blog/bms-wiring-guide-balance-leads-main-cables-order-of-connection.html">wiring guide</a>.</li>
        <li>Test with a low load before connecting the inverter.</li>
      </ol>
      <h2>Inverter settings</h2>
      <p>Set the inverter to lithium or custom voltages for 8S LFP. See the <a href="/blog/bms-for-24v-inverter-ups-8s-lfp-100amp-which-board.html">24 V BMS guide</a>.</p>`,
    faq: [
      ['How many hours can 5.9 kWh run a 500W load?', 'Roughly 10 to 11 hours, allowing for inverter loss and a safe depth of discharge. Real figures vary.'],
      ['Can I expand later?', 'Add a second identical battery in parallel through a proper breaker setup, with matched voltage; ask a qualified installer.'],
      ['Do 230Ah cells need compression?', 'Prismatic cells are generally compressed within the range the cell maker specifies.'],
    ],
  }),

  mk({
    slug: 'compare-100ah-lfp-cells-bak-tianneng-high-power-highstar',
    category: 'Prismatic Cells', tag: 'LFP Cells',
    title: 'Comparing 100Ah LFP Cells: BAK, Tianneng, High Power and Highstar',
    short: ['Comparing 100Ah LFP Cells', 'BAK, Tianneng, High Power, Highstar'],
    description: 'How to compare 100Ah prismatic LFP cells from BAK, Tianneng, High Power and Highstar: datasheet points, terminals, matching and price per kWh. Live prices from Arambhika, Noida.',
    keywords: 'BAK 100Ah LFP, Tianneng 100Ah, High Power 100Ah, Highstar 100Ah, 100Ah LFP cell comparison India',
    productsHeading: '100Ah prismatic LFP cells',
    intro: 'We list four 100Ah prismatic cells. They look similar on paper, so compare them on what matters for your build.',
    body: `
      <h2>The four cells</h2>
      <ul>
        <li><a href="${p('BAK LFP CELL 3.2V 100Ah')}">BAK LFP 3.2V 100Ah</a></li>
        <li><a href="${p('TIANNENG 3.2V - 100Ah Prismatic Cell')}">Tianneng 3.2V 100Ah</a></li>
        <li><a href="${p('High Power - 100Ah Prismatic Cell')}">High Power 100Ah</a></li>
        <li><a href="${p('Highstar - 100Ah Laser Weld Prismatic Cell')}">Highstar 100Ah laser weld</a></li>
      </ul>
      <h2>What to compare</h2>
      <table class="blog-table">
        <thead><tr><th>Check</th><th>Why it matters</th></tr></thead>
        <tbody>
          <tr><td>Continuous discharge rate</td><td>Sets the current the pack can supply</td></tr>
          <tr><td>Internal resistance</td><td>Lower means less heat and voltage sag</td></tr>
          <tr><td>Terminal type</td><td>Bolted or laser weld decides your busbar method</td></tr>
          <tr><td>Dimensions</td><td>Must fit your enclosure and busbar spacing</td></tr>
          <tr><td>Price per kWh</td><td>Divide live price by 0.32 kWh</td></tr>
        </tbody>
      </table>
      <h2>Do not mix brands in one pack</h2>
      <p>Cells in the same series string should be identical. Buy a full pack's worth from one brand and one batch. See our <a href="/blog/buying-lfp-prismatic-cells-india-checklist-matching-grade-testing.html">cell checklist</a>.</p>
      <h2>Typical builds</h2>
      <p>The 4S 12.8 V pack in our <a href="/blog/build-12v-100ah-lfp-battery-replace-lead-acid-inverter-india.html">12V build</a> is the simplest use for these cells.</p>`,
    faq: [
      ['Which brand is the cheapest?', 'It changes with stock. The listings show the live price.'],
      ['Can I use any BMS?', 'Yes, as long as it matches 3.2 V LFP cells, your series count and your current.'],
      ['Should I ask for test data?', 'Yes. Ask for the datasheet and any capacity test the supplier has for your batch.'],
    ],
  }),

  mk({
    slug: 'lfp-prismatic-cell-compression-swelling-fixture-why-it-matters',
    category: 'Prismatic Cells', tag: 'Pack Building',
    title: 'LFP Prismatic Cell Compression: Why Cells Swell and How to Clamp Them',
    short: ['Prismatic Cell Compression', 'Why LFP cells need clamping'],
    description: 'Why prismatic LFP cells swell over their life, how clamping with end plates and straps helps, how to follow the maker\'s compression range, and what to use between cells. Parts from Arambhika.',
    keywords: 'prismatic cell compression, LFP cell swelling, battery cell clamping fixture, end plates LFP pack, 314Ah compression',
    productsHeading: 'Prismatic cells and insulation sheet',
    intro: 'Prismatic LFP cells grow slightly as they charge and age. A pack that ignores this can lose life or loosen joints.',
    body: `
      <h2>Why cells swell</h2>
      <p>Inside, the electrodes change volume with state of charge, and over time gas and ageing add a little more. The cell cans flex, especially the large faces. Packs without restraint let the cell bulge, which can affect cycle life.</p>
      <h2>Clamping the stack</h2>
      <ol>
        <li>Find the compression range the maker gives for the cell (a force or a pressure).</li>
        <li>Use rigid end plates and threaded rods or straps to hold the stack within that range.</li>
        <li>Put a flat insulating separator between cells where cans are conductive, for example <a href="${p('EPOXY SHEET (502*338*1MM)')}">epoxy sheet</a>.</li>
        <li>Re-check tightness after the first cycles.</li>
      </ol>
      <h2>Do not over-tighten</h2>
      <p>Too much force is as bad as none. Keep within the stated range and use the same compression on every cell.</p>
      <h2>Which cells need it?</h2>
      <p>All large prismatic cells, such as the <a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">314Ah</a> and <a href="${p('CALB 3.2V - 280Ah Prismatic Cell')}">280Ah</a>. Follow the datasheet of the model you use. See the <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah build</a> for assembly order.</p>`,
    faq: [
      ['Is a plastic case enough?', 'Not unless it is designed to hold the stack under the required compression.'],
      ['Do 100Ah cells need compression?', 'Check each model\'s datasheet; smaller cells may have lighter requirements.'],
      ['Can I use foam between cells?', 'Some designs do. Choose a material that gives even pressure and does not creep away over time.'],
    ],
  }),

  mk({
    slug: 'top-balancing-lfp-cells-before-assembling-a-battery-pack',
    category: 'Prismatic Cells,BMS', tag: 'Pack Building',
    title: 'Top Balancing LFP Cells Before You Assemble the Pack: Why and How',
    short: ['Top Balancing LFP Cells', 'Start every cell at the same full voltage'],
    description: 'Why new LFP cells should be top-balanced in parallel before building a series pack, the steps to do it safely, and what to expect from your BMS afterwards. Cells and BMS from Arambhika.',
    keywords: 'top balancing LFP, how to balance LFP cells, parallel balance new cells, LFP battery assembly, cell matching',
    productsHeading: 'Cells and BMS for a balanced pack',
    intro: 'Cells arrive at slightly different voltages. Joining them in series like that means the pack starts out unbalanced.',
    body: `
      <h2>Why top balance</h2>
      <p>LFP cells have a flat voltage curve, so differences hide until the end of charge. A BMS balances only slowly. Starting all cells at the same top-of-charge point gives the BMS far less to correct.</p>
      <h2>The steps</h2>
      <ol>
        <li>Measure and record each cell's voltage.</li>
        <li>Connect all cells in <strong>parallel</strong> with equal-length connections (positives together, negatives together).</li>
        <li>Charge the parallel group with a bench supply to the cell's full-charge voltage (about 3.65 V for LFP, check the datasheet), allowing the current to taper.</li>
        <li>Hold until current falls to a small value, then rest for hours.</li>
        <li>Disconnect and measure; voltages should now agree closely.</li>
        <li>Assemble in series with <a href="${p('Aluminium Busbar Model 1 C2C Series')}">series busbars</a> and fit the BMS.</li>
      </ol>
      <h2>Safety</h2>
      <p>Use a current-limited supply, cells of the same model, short thick links and constant supervision. Never leave this unattended.</p>
      <h2>After assembly</h2>
      <p>A smart BMS such as the <a href="${p('DALY ESS 16S - 100AMP SMART BMS (New Model)')}">Daly ESS 16S</a> shows cell voltages, so you can confirm the pack is in step. See also the <a href="/blog/buying-lfp-prismatic-cells-india-checklist-matching-grade-testing.html">cell checklist</a> and <a href="/blog/lfp-prismatic-cell-compression-swelling-fixture-why-it-matters.html">compression guide</a>.</p>`,
    faq: [
      ['Do I need to top balance every pack?', 'It is good practice for large cells, especially when cells arrived with different voltages.'],
      ['How long does it take?', 'It depends on cell size, supply current and the voltage difference. Large cells can take many hours.'],
      ['Can the BMS do it for me?', 'It will balance over time, but a large initial gap can take a very long time to close.'],
    ],
  }),
]
