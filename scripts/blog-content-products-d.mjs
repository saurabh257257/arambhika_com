// Product-led posts, part D: Daly BMS models, one by one.
import { p, mk } from './blog-products-lib.mjs'

export const posts = [
  mk({
    slug: 'daly-lfp-4s-300amp-smart-bms-12v-inverter-heavy-load',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly LFP 4S 300A Smart BMS: When a 12V Battery Needs Heavy Current',
    short: ['Daly 4S 300A BMS for 12V Loads', 'Heavy-current 12V inverter and RV packs'],
    description: 'When a 12.8V LFP battery needs a 300A BMS instead of 100A: inverters, RVs and winches. Current maths, wiring notes and the Daly LFP 4S 300A smart BMS with live price from Arambhika.',
    keywords: 'Daly 4S 300A BMS, 12V LFP BMS 300A, 300 amp BMS India, 12V inverter lithium BMS, heavy load LFP battery',
    productsHeading: 'Daly 4S BMS boards',
    intro: 'At 12 V, even a modest inverter pulls a lot of current. A 100A board that is fine at 48 V can be too small at 12 V.',
    body: `
      <h2>The current gets big fast</h2>
      <p>Current equals power divided by voltage. A 12.8 V pack feeding a 3 kW inverter draws about 234 A, because 3000 / 12.8 is roughly 234. A 100 A BMS would trip at once, and even a 200 A one would be near its limit. The <a href="${p('DALY LFP 4S-300AMP SMART BMS')}">Daly LFP 4S 300A smart BMS</a> exists for loads like this.</p>
      <h2>Where 300A makes sense</h2>
      <ul>
        <li>2 to 3 kW inverters on a 12 V bank.</li>
        <li>Caravans, boats and workshops with large 12 V loads.</li>
        <li>Winches and other short, high-surge loads, within the BMS peak rating.</li>
      </ul>
      <h2>The rest of the circuit must keep up</h2>
      <p>A 300A BMS only helps if cells, cables, busbars and fuse can carry the same current. Check that your cells support the discharge rate: 300 A from a 100Ah cell is 3C, which many cells do not allow continuously. Four <a href="${p('Highstar - 100Ah Laser Weld Prismatic Cell')}">100Ah cells</a> are rarely enough for a 3 kW load; consider higher capacity or a 24 V design.</p>
      <h2>A 24 V alternative</h2>
      <p>Doubling the voltage halves the current. A 24 V (8S) pack running the same 3 kW inverter draws about 117 A, which suits a hardware or smart <a href="${p('DALY LFP 8S-100AMP HARDWARE BMS')}">8S 100A BMS</a>. Read the <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">current rating guide</a> for the sums.</p>`,
    faq: [
      ['Can I use a 300A BMS with 100Ah cells?', 'Only if the cells are rated for the current you will actually draw. Check the cell datasheet for continuous discharge.'],
      ['Is 24V better than 12V for a big inverter?', 'Usually yes. Half the current means thinner cable, smaller fuses and less heat.'],
      ['Does the BMS need a heatsink?', 'Follow the BMS manual. At high current, mount the board where air can move and keep wiring short.'],
    ],
  }),

  mk({
    slug: 'daly-lfp-15s-250amp-smart-bms-high-power-48v-electric-vehicle',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly LFP 15S 250A Smart BMS for High-Power 48V Electric Vehicles',
    short: ['Daly 15S 250A BMS for 48V EVs', 'For motors that outgrow a 100A board'],
    description: 'Who needs a 250A BMS on a 48V LFP pack: powerful scooters, three-wheelers and cargo vehicles. Power maths, cell and wiring requirements with the Daly 15S 250A smart BMS from Arambhika.',
    keywords: 'Daly 15S 250A BMS, 48V LFP BMS 250 amp, high power electric scooter BMS, 15S smart BMS India, e-cargo battery',
    productsHeading: 'Daly 15S BMS in several current ratings',
    intro: 'Most 48 V vehicles are happy with a 60 A to 100 A BMS. A few go well past that, and for those the 250A board is the right tool.',
    body: `
      <h2>What 250A means in power</h2>
      <p>At about 48 V, 250 A is around 12 kW of peak power. That is the territory of strong scooters, three-wheel cargo vehicles and small utility EVs. For typical e-scooters, a smaller board such as the <a href="${p('DALY LFP 15S-100AMP SMART BMS')}">15S 100A</a> or <a href="${p('DALY LFP 15S-80AMP SMART BMS')}">15S 80A</a> is enough.</p>
      <h2>Check three things first</h2>
      <ol>
        <li><strong>Controller current.</strong> Look at the controller's battery current limit, not the motor's peak.</li>
        <li><strong>Cell rating.</strong> Prismatic LFP cells of 100Ah rated 1C give 100 A; you need cells or parallel strings that support the load.</li>
        <li><strong>Interconnects.</strong> Use copper <a href="${p('COPPER BUS BAR Universal (82x20x2mm)- Tin Coated')}">busbar</a>, not thin nickel strip, at this current.</li>
      </ol>
      <h2>The <a href="${p('DALY LFP 15S-250AMP SMART BMS')}">15S 250A smart BMS</a></h2>
      <p>It brings Bluetooth monitoring to a high-current pack, so you can watch current and cell voltages during a hard ride or load test. Mount it with good airflow and keep the main cables short and thick.</p>
      <h2>Do not oversize blindly</h2>
      <p>A 250A board on a 40A system is wasted money. Size to your measured peak with margin, using our <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">rating guide</a>.</p>`,
    faq: [
      ['Which controller needs a 250A BMS?', 'Controllers whose battery current limit approaches that figure. Read the limit in the controller specification.'],
      ['Is 48V LFP 15S or 16S?', 'Both are used. Match the BMS to the series count of your cells and to what the charger and controller expect.'],
      ['Can nickel strip carry 250A?', 'Not safely in a normal pack. Use copper busbar or multiple parallel paths designed for the current.'],
    ],
  }),

  mk({
    slug: 'daly-lfp-30s-150amp-smart-bms-96v-battery-pack',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly LFP 30S 150A Smart BMS for 96V Battery Packs',
    short: ['Daly 30S BMS for 96V Packs', 'High-voltage LFP for larger vehicles'],
    description: 'What a 30S LFP battery is (about 96V), where it is used, and how to plan cells, busbar and safety for it. The Daly LFP 30S 150A smart BMS with live price from Arambhika, Noida.',
    keywords: 'Daly 30S BMS, 96V LFP battery BMS, 30S LFP pack India, high voltage LFP BMS, 96V electric vehicle battery',
    productsHeading: 'High series-count Daly BMS',
    intro: 'Thirty LFP cells in series make a battery near 96 V. Higher voltage means lower current for the same power, which suits larger vehicles.',
    body: `
      <h2>The voltage maths</h2>
      <p>30 cells at 3.2 V nominal gives 96 V; fully charged it sits near 109 V. At that voltage a 150 A board handles about 14 kW, using the <a href="${p('DALY LFP 30S-150AMP SMART BMS')}">Daly LFP 30S 150A smart BMS</a>.</p>
      <h2>Why go to 96V</h2>
      <ul>
        <li>Less current for the same power, so thinner cable and cooler joints.</li>
        <li>Better for larger motors, small electric trucks and some forklift-type uses.</li>
        <li>Fewer parallel strings needed for the same output.</li>
      </ul>
      <h2>Safety is different at this voltage</h2>
      <p>Anything above 60 V DC needs more care. Use insulated tools, plan clear isolation between modules, and fit a main contactor or breaker rated for the voltage. Consider a service disconnect so the pack can be split into lower-voltage sections during assembly.</p>
      <h2>Parts to pair</h2>
      <p>Choose matched prismatic cells such as the <a href="${p('GREATPOWER LFP CELL 3.2V 150Ah')}">150Ah GreatPower</a> or <a href="${p('Ganfeng - 150Ah Laser Weld Prismatic Cell')}">Ganfeng 150Ah</a>, tin-coated copper busbar, and <a href="/blog/epoxy-sheet-insulation-battery-pack-thickness-guide.html">epoxy sheet</a> between modules. See the <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">series count guide</a> for lower-voltage options.</p>`,
    faq: [
      ['How many cells is a 96V LFP pack?', '30 in series (30S), about 96 V nominal.'],
      ['Is a 30S pack more dangerous than 48V?', 'Higher voltage carries a bigger shock risk. Work with insulated tools and follow safe isolation procedures.'],
      ['Does the charger have to match?', 'Yes. Use a charger made for a 30S LFP pack at the correct charge voltage.'],
    ],
  }),

  mk({
    slug: 'daly-lfp-23s-72v-bms-60a-vs-100a-e-rickshaw-scooter',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly 23S LFP BMS: Choosing 40A, 60A or 100A for a 72V Pack',
    short: ['Daly 23S BMS: 40A, 60A or 100A?', 'Right-sizing a 72V LFP pack BMS'],
    description: 'How to choose between Daly 23S LFP BMS in 40A, 60A and 100A, smart or hardware, for 72V e-rickshaw, scooter and cargo packs. Power maths and live prices from Arambhika, Noida.',
    keywords: 'Daly 23S BMS, 72V LFP BMS, 23S 100A BMS India, e-rickshaw BMS, 73.6V LFP battery',
    productsHeading: 'Daly 23S LFP BMS options',
    intro: 'A 23S LFP pack is about 73.6 V, the common 72 V class. Daly sells it in several ratings and in both smart and hardware form.',
    body: `
      <h2>Power each rating supports</h2>
      <table class="blog-table">
        <thead><tr><th>Rating</th><th>Approx. power at 73.6 V</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td>40 A</td><td>about 2.9 kW</td><td>Light scooters and small loaders</td></tr>
          <tr><td>60 A</td><td>about 4.4 kW</td><td>Mid-power scooters and 3-wheelers</td></tr>
          <tr><td>100 A</td><td>about 7.4 kW</td><td>Heavy 3-wheelers and cargo</td></tr>
        </tbody>
      </table>
      <h2>Models available</h2>
      <ul>
        <li><a href="${p('DALY LFP 23S-40AMP HARDWARE BMS')}">23S 40A hardware</a></li>
        <li><a href="${p('DALY LFP 23S-60AMP HARDWARE BMS')}">23S 60A hardware</a> and <a href="${p('DALY LFP 23S-60AMP SMART BMS')}">23S 60A smart</a></li>
        <li><a href="${p('DALY LFP 23S-100AMP HARDWARE BMS')}">23S 100A hardware</a> and <a href="${p('DALY LFP 23S-100AMP SMART BMS')}">23S 100A smart</a></li>
      </ul>
      <h2>Smart or hardware?</h2>
      <p>For fleet vehicles, the smart version lets a technician read cell voltages over Bluetooth without opening the pack. For cost-sensitive builds, the hardware version protects the pack without extra features. See the <a href="/blog/smart-bms-vs-hardware-bms-daly-which-to-buy-india.html">comparison</a>.</p>
      <h2>Use the controller's limit</h2>
      <p>Take the controller's battery current limit, add margin, and pick the next rating up. Read the <a href="/blog/e-rickshaw-e-auto-battery-pack-nickel-strip-busbar-india.html">e-rickshaw pack guide</a> for the wider build.</p>`,
    faq: [
      ['Is 23S the same as 72V?', 'About. 23 LFP cells give 73.6 V nominal, sold as a 72 V pack.'],
      ['Can I use a 20S NMC BMS on LFP cells?', 'No. NMC and LFP boards use different voltage limits. Buy the BMS for your chemistry and series count.'],
      ['What if my motor needs more than 100A?', 'Move to a higher-rated BMS, or raise pack voltage so the same power needs less current.'],
    ],
  }),

  mk({
    slug: 'daly-nmc-13s-bms-40a-vs-60a-48v-e-bike-battery',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly NMC 13S BMS: 40A vs 60A for a 48V E-Bike Battery',
    short: ['Daly NMC 13S BMS: 40A vs 60A', 'Choosing a BMS for a 48V e-bike pack'],
    description: 'Compare Daly NMC 13S smart and hardware BMS in 40A and 60A for 48V e-bike and scooter battery packs, with controller current, cell choice and live prices from Arambhika, Noida.',
    keywords: 'Daly NMC 13S BMS, 48V e-bike BMS, 13S 40A BMS, 13S 60A BMS India, 21700 e-bike battery BMS',
    productsHeading: 'Daly NMC 13S BMS',
    intro: '13S is the standard series count for a 48 V NMC e-bike pack. The only real choice is the amp rating and whether you want Bluetooth.',
    body: `
      <h2>40A or 60A?</h2>
      <p>At 46.8 V nominal, 40 A is about 1.9 kW and 60 A about 2.8 kW. A typical 500 W to 1000 W hub motor is covered by 40 A. Choose 60 A for stronger motors, or if you want headroom for uphill loads.</p>
      <h2>Models</h2>
      <ul>
        <li><a href="${p('DALY NMC 13S-40AMP SMART BMS')}">13S 40A smart</a> and <a href="${p('DALY NMC 13S-60AMP SMART BMS')}">13S 60A smart</a>, with Bluetooth monitoring</li>
        <li><a href="${p('DALY NMC 13S-40AMP HARDWARE BMS')}">13S 40A hardware</a>, the simplest and lowest-cost choice</li>
      </ul>
      <h2>Match it to the cells</h2>
      <p>A 13S4P pack of 4500 mAh cells such as the <a href="${p('NORDA NMC CELL 21700 4500 mAh')}">Norda 21700</a> must supply your peak current; confirm the cell discharge rating times four covers it. Our <a href="/blog/build-13s-nmc-48v-battery-pack-21700-cells-step-by-step.html">13S build guide</a> shows the full layout.</p>
      <h2>Charging</h2>
      <p>Use a charger made for 13S NMC, with a full-charge voltage near 54.6 V. A BMS is a safety net, not a replacement for the right charger.</p>`,
    faq: [
      ['Is 13S the same as 48V?', 'A 13S NMC pack is 46.8 V nominal and is sold as 48 V.'],
      ['Do I need the smart version for an e-bike?', 'No, but it helps when you want to check cell balance or diagnose range loss.'],
      ['Can one BMS handle a motor and a charger?', 'Most single-port BMS handle both through the same terminals, within the rating. Check the manual for your model.'],
    ],
  }),

  mk({
    slug: 'daly-nmc-20s-40amp-smart-bms-72v-nmc-battery',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly NMC 20S 40A Smart BMS for 72V Lithium-Ion Packs',
    short: ['Daly NMC 20S BMS for 72V Packs', 'A 72V NMC pack from 20 cells in series'],
    description: 'Plan a 72V NMC lithium-ion pack: 20 cells in series, power at 40A, charger and wiring, with the Daly NMC 20S 40A smart BMS and 21700 cell options from Arambhika, Noida.',
    keywords: 'Daly NMC 20S BMS, 72V NMC battery pack, 20S lithium ion BMS India, 72V e-scooter battery build',
    productsHeading: 'NMC BMS and cells for a 72V pack',
    intro: 'Twenty NMC cells in series give 72 V nominal, around 84 V when full. It is a common voltage for faster scooters and light electric motorcycles.',
    body: `
      <h2>Power at 40A</h2>
      <p>72 V times 40 A is about 2.9 kW. That suits a mid-power scooter. Heavier motors may need a higher-current approach, such as the <a href="${p('JBD NMC 20S-50AMP HARDWARE BMS')}">JBD NMC 20S 50A</a>, or a different pack design. The Daly choice here is the <a href="${p('DALY NMC 20S-40AMP SMART BMS')}">NMC 20S 40A smart BMS</a>.</p>
      <h2>Cell count</h2>
      <p>20S with four cells in parallel is 80 cells (20S4P). With 4500 mAh cells such as <a href="${p('LITHIUM-ION CELL 4500 mAh DMEGC 21700')}">DMEGC 21700</a> that is 18 Ah, about 1.3 kWh. Add strip, holders and insulation from the <a href="/blog/battery-pack-bill-of-materials-components-checklist-india.html">bill of materials</a>.</p>
      <h2>Voltage safety</h2>
      <p>At 84 V full charge, treat the pack as high voltage. Use insulated tools and fit a fuse on the main positive. Keep the spot-welded groups separated until you are ready to join the series string.</p>
      <h2>Charger match</h2>
      <p>Choose a 20S NMC charger with the correct end voltage. Compare with the <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">LFP and NMC series-count table</a> before ordering anything.</p>`,
    faq: [
      ['What is the full-charge voltage of a 20S NMC pack?', 'About 84 V, at 4.2 V per cell.'],
      ['Is 40A enough for my scooter?', 'Compare it with your controller\'s battery current limit. Choose a higher-rated BMS if the limit is above 40 A.'],
      ['Can I use a 24S LFP BMS?', 'No. Use a BMS made for the chemistry and number of cells in your pack.'],
    ],
  }),

  mk({
    slug: 'daly-semi-smart-7s-17s-bms-what-semi-smart-means',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly 7S-17S Semi-Smart BMS: What "Semi-Smart" Means and Who It Suits',
    short: ['Daly 7S-17S Semi-Smart BMS', 'One adjustable board for many pack sizes'],
    description: 'What a semi-smart BMS is, how the Daly 7S-17S 40A board covers many series counts with one part, and when to pick it over a fixed hardware BMS. Live price from Arambhika, Noida.',
    keywords: 'Daly 7S-17S BMS, semi smart BMS India, universal BMS 40A, Daly semi smart, adjustable series BMS',
    productsHeading: 'Daly semi-smart and universal BMS',
    intro: 'A semi-smart BMS sits between a fixed hardware board and a fully smart one. The Daly 7S-17S 40A board is built to serve many pack sizes with a single part number.',
    body: `
      <h2>What "semi-smart" gives you</h2>
      <p>It offers some of the settings and monitoring of a smart BMS without the full feature set. Details vary by model, so check the specification of the <a href="${p('DALY 7S-17S- 40AMP SEMI SMART BMS')}">Daly 7S-17S 40A semi-smart BMS</a> for exactly what it reads and lets you change.</p>
      <h2>Why a wide series range helps</h2>
      <p>A workshop building packs of different sizes can stock one board instead of many. The same unit might serve a 10S, 13S or 16S build once set up for the cell count. That reduces inventory and mistakes.</p>
      <h2>Who it suits</h2>
      <ul>
        <li>Pack assemblers with varied orders.</li>
        <li>Repair shops matching mixed pack sizes.</li>
        <li>Builders who want some monitoring without paying for the top tier.</li>
      </ul>
      <h2>Alternatives</h2>
      <p>For 100 A or Bluetooth with RS485 and CAN, see the <a href="${p('DALY SMART 7S-24S - 60AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">smart 7S-24S range</a>. If the pack size never changes, a fixed board is simpler.</p>`,
    faq: [
      ['How do I tell the board my cell count?', 'Follow the setup steps in the manual for the model. Some boards detect or are configured through an app.'],
      ['Is a semi-smart BMS safe for LFP and NMC?', 'Check that the chemistry is supported and set correctly before charging. Wrong settings can overcharge cells.'],
      ['Can it replace my hardware BMS?', 'If the series count and current fit, usually yes. Confirm the wiring layout first.'],
    ],
  }),

  mk({
    slug: 'daly-hardware-bms-range-lfp-8s-15s-16s-19s-20s-23s',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly Hardware BMS Range for LFP: 8S, 15S, 16S, 19S, 20S and 23S Compared',
    short: ['Daly Hardware BMS Range for LFP', 'Which series count and amp rating to pick'],
    description: 'A table of Daly LFP hardware BMS from 8S to 23S with typical pack voltages, amp options and uses. Pick the right fixed-threshold board for e-bikes, inverters and EVs. Live prices from Arambhika.',
    keywords: 'Daly LFP hardware BMS, 8S 15S 16S 23S BMS, hardware BMS India, 25.6V 48V 51.2V 73.6V LFP BMS',
    productsHeading: 'Daly LFP hardware BMS',
    intro: 'Hardware BMS boards are simple, cheaper protection for packs that do not need monitoring. Daly sells them across many series counts.',
    body: `
      <h2>Pick by voltage</h2>
      <table class="blog-table">
        <thead><tr><th>Series</th><th>Nominal voltage</th><th>Example boards</th></tr></thead>
        <tbody>
          <tr><td>8S</td><td>25.6 V</td><td><a href="${p('DALY LFP 8S-20AMP HARDWARE BMS')}">20A</a>, <a href="${p('DALY LFP 8S-30AMP HARDWARE BMS')}">30A</a>, <a href="${p('DALY LFP 8S-40AMP HARDWARE BMS')}">40A</a>, <a href="${p('DALY LFP 8S-100AMP HARDWARE BMS')}">100A</a></td></tr>
          <tr><td>15S</td><td>48 V</td><td><a href="${p('DALY LFP 15S-60AMP HARDWARE BMS')}">60A</a>, <a href="${p('DALY LFP 15S-80AMP HARDWARE BMS')}">80A</a>, <a href="${p('DALY LFP 15S-100AMP HARDWARE BMS')}">100A</a></td></tr>
          <tr><td>16S</td><td>51.2 V</td><td><a href="${p('DALY LFP 16S-60AMP HARDWARE BMS')}">60A</a>, <a href="${p('DALY LFP 16S-100AMP HARDWARE BMS')}">100A</a></td></tr>
          <tr><td>19S</td><td>60.8 V</td><td><a href="${p('DALY LFP 19S-80AMP HARDWARE BMS')}">80A</a></td></tr>
          <tr><td>20S</td><td>64 V</td><td><a href="${p('DALY LFP 20S-40AMP HARDWARE BMS')}">40A</a></td></tr>
          <tr><td>23S</td><td>73.6 V</td><td><a href="${p('DALY LFP 23S-40AMP HARDWARE BMS')}">40A</a>, <a href="${p('DALY LFP 23S-60AMP HARDWARE BMS')}">60A</a>, <a href="${p('DALY LFP 23S-100AMP HARDWARE BMS')}">100A</a></td></tr>
        </tbody>
      </table>
      <h2>What a hardware BMS does and does not do</h2>
      <p>It protects against over-charge, over-discharge, over-current and short circuit with fixed thresholds. It has no app. If you want to see cell voltages, choose a <a href="/blog/smart-bms-vs-hardware-bms-daly-which-to-buy-india.html">smart board</a>.</p>
      <h2>Choosing the rating</h2>
      <p>Use the controller's current limit with margin; our <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">rating guide</a> has worked examples. Two common 4S boards also exist: the <a href="${p('DALY LFP 4S-100AMP HARDWARE BMS')}">4S 100A hardware</a> for 12 V packs.</p>`,
    faq: [
      ['What does the "IH" in some model names mean?', 'We list a few IH variants; ask us on WhatsApp which one fits your application and wiring before ordering.'],
      ['Does a hardware BMS balance cells?', 'Most do basic balancing. Check the specification for the board you choose.'],
      ['Can I swap a hardware BMS for a smart one later?', 'Yes, if the series count and current match. The wiring is similar.'],
    ],
  }),

  mk({
    slug: 'daly-smart-7s-24s-bms-bluetooth-rs485-can-40a-60a-100a',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Daly Smart 7S-24S BMS with Bluetooth, RS485 and CAN: 40A, 60A and 100A',
    short: ['Daly Smart 7S-24S BMS', 'One board for many pack sizes, with comms'],
    description: 'The Daly Smart 7S-24S BMS covers many series counts with inbuilt balancer, Bluetooth, RS485 and CAN. Compare the 40A, 60A and 100A versions and see where each fits. Live prices from Arambhika.',
    keywords: 'Daly Smart 7S-24S BMS, BMS with CAN RS485 Bluetooth, universal smart BMS India, Daly 7S-24S 100A',
    productsHeading: 'Daly Smart 7S-24S BMS',
    intro: 'This board is built for flexibility: one hardware family that works across many cell counts, with a balancer and communication options on board.',
    body: `
      <h2>What is on the board</h2>
      <ul>
        <li>An inbuilt balancer to keep cells in step.</li>
        <li>Bluetooth for phone monitoring and settings.</li>
        <li>RS485 and CAN ports for talking to an inverter, charger or display.</li>
      </ul>
      <h2>Three current ratings</h2>
      <table class="blog-table">
        <thead><tr><th>Rating</th><th>Product</th></tr></thead>
        <tbody>
          <tr><td>40 A</td><td><a href="${p('DALY SMART 7S-24S - 40AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">Daly Smart 7S-24S 40A</a></td></tr>
          <tr><td>60 A</td><td><a href="${p('DALY SMART 7S-24S - 60AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">Daly Smart 7S-24S 60A</a></td></tr>
          <tr><td>100 A</td><td><a href="${p('DALY SMART 7S-24S - 100AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">Daly Smart 7S-24S 100A</a></td></tr>
        </tbody>
      </table>
      <h2>Good fits</h2>
      <p>Packs from roughly 24 V to the high-voltage end of the range, for inverters with CAN or RS485 support, for fleets that want one spare board type, and for builders who change pack sizes often.</p>
      <h2>Before you buy</h2>
      <p>Confirm the chemistry setting you need, the series count and whether your inverter speaks the protocol this board offers. Read about <a href="/blog/daly-ess-active-balancing-bms-home-solar-battery-india.html">active balancing boards</a> if your cells are large.</p>`,
    faq: [
      ['Does it work with LFP and NMC?', 'Check the product specification for the chemistries supported and how to select them.'],
      ['Will CAN work with any inverter?', 'No. The inverter must support the protocol the BMS uses. Check both manuals.'],
      ['Is the balancer active or passive?', 'Read the specification of the model you pick. The ESS range is the one with active balancing.'],
    ],
  }),

  mk({
    slug: 'daly-ess-15s-new-model-vs-active-balancing-which-to-choose',
    category: 'BMS', tag: 'Energy Storage',
    title: 'Daly ESS 15S: New Model vs Active Balancing Version, Which to Choose?',
    short: ['Daly ESS 15S: New Model or Active?', 'Two ESS boards for 48V storage packs'],
    description: 'Daly sells more than one 15S ESS smart BMS. Compare the active-balancing 100A and 150A versions and the new-model 100A for home solar storage in India. Live prices from Arambhika, Noida.',
    keywords: 'Daly ESS 15S BMS, ESS BMS new model, 15S 150A BMS solar, active balancing ESS India',
    productsHeading: 'Daly ESS BMS for storage',
    intro: 'Home storage packs tend to use the ESS family of Daly boards. There are three 15S options, and the right one depends on current and balancing needs.',
    body: `
      <h2>The three 15S ESS boards</h2>
      <table class="blog-table">
        <thead><tr><th>Board</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('DALY ESS 15S - 100AMP SMART BMS ACTIVE BALANCING')}">ESS 15S 100A active balancing</a></td><td>Moves charge between cells; good for large cells</td></tr>
          <tr><td><a href="${p('DALY ESS 15S - 150AMP SMART BMS ACTIVE BALANCING')}">ESS 15S 150A active balancing</a></td><td>Same, with more current for bigger inverters</td></tr>
          <tr><td><a href="${p('DALY ESS 15S - 100AMP SMART BMS(New Model)')}">ESS 15S 100A new model</a></td><td>Updated version of the 100A board; read the current specification</td></tr>
        </tbody>
      </table>
      <h2>Picking by inverter</h2>
      <p>Take the inverter's rated DC input current at your battery voltage. A 3 kW inverter at 48 V draws about 62 A; 5 kW about 104 A. The 100A boards suit the first; the 150A board gives room for the second.</p>
      <h2>If you want 16S</h2>
      <p>For 51.2 V packs, see the <a href="${p('DALY ESS 16S - 100AMP SMART BMS (New Model)')}">ESS 16S 100A new model</a> and our <a href="/blog/daly-ess-active-balancing-bms-home-solar-battery-india.html">active balancing guide</a>. Pair either with the cells in our <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah build</a>.</p>
      <h2>Ask before you order</h2>
      <p>Specifications change between model generations. Send us your inverter model and we will confirm which board suits it.</p>`,
    faq: [
      ['What changed in the "new model"?', 'Ask us for the current specification sheet; revisions vary. We can tell you what applies to the stock we hold.'],
      ['Is 15S or 16S better for solar?', 'Either, if your inverter supports the voltage range. 16S gives about 51.2 V and is common with 48 V class inverters.'],
      ['Can I upgrade from 100A to 150A later?', 'You can swap the BMS if the series count matches and the wiring and cells can carry the current.'],
    ],
  }),
]
