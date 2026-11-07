// Product-led posts, part A: BMS, cell holders, epoxy sheet and potting compound.
import { p, mk } from './blog-products-lib.mjs'

const SMART_4S = 'DALY LFP 4S-100AMP SMART BMS'
const HW_4S = 'DALY LFP 4S-100AMP HARDWARE BMS'
const SMART_15S = 'DALY LFP 15S-100AMP SMART BMS'
const SMART_23S = 'DALY LFP 23S-100AMP SMART BMS'
const NMC_13S = 'DALY NMC 13S-60AMP SMART BMS'
const NMC_20S = 'DALY NMC 20S-40AMP SMART BMS'
const ESS_15S = 'DALY ESS 15S - 100AMP SMART BMS ACTIVE BALANCING'
const ESS_15S_150 = 'DALY ESS 15S - 150AMP SMART BMS ACTIVE BALANCING'
const ESS_16S = 'DALY ESS 16S - 100AMP SMART BMS (New Model)'
const UNIV_100 = 'DALY SMART 7S-24S - 100AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can'

export const posts = [
  mk({
    slug: 'smart-bms-vs-hardware-bms-daly-which-to-buy-india',
    category: 'BMS', tag: 'BMS Guide',
    title: 'Smart BMS vs Hardware BMS: Which Daly BMS Should You Buy in India?',
    short: ['Smart BMS vs Hardware BMS', 'What you get for the extra rupees'],
    description: 'Smart BMS or hardware BMS for your lithium pack? Compare Bluetooth monitoring, settings, price and use cases for Daly BMS boards, with live prices from Arambhika, Noida.',
    keywords: 'smart BMS vs hardware BMS, Daly smart BMS India, Daly hardware BMS, Bluetooth BMS India, lithium battery BMS buy',
    productsHeading: 'Daly smart and hardware BMS boards',
    intro: 'Every lithium pack needs a battery management system, but the same cell count is sold as both a "smart" and a "hardware" BMS at very different prices. Here is what actually changes, and which one suits which build.',
    body: `
      <h2>What a hardware BMS does</h2>
      <p>A hardware BMS protects the pack with fixed thresholds: over-charge, over-discharge, over-current and short-circuit, plus basic balancing. You fit it, wire it and forget it. There is no screen, app or data, and the cut-off values are set at the factory. For a simple pack where you only need protection, this is the lower-cost route, for example the <a href="${p(HW_4S)}">Daly LFP 4S 100A hardware BMS</a>.</p>

      <h2>What a smart BMS adds</h2>
      <p>A smart BMS talks to you. Over Bluetooth you can see the pack voltage, current, state of charge, each cell voltage and temperatures on your phone, and many models let you change protection settings. Some also offer RS485 or CAN communication so an inverter or charger can read the pack. See the <a href="${p(SMART_4S)}">Daly LFP 4S 100A smart BMS</a> for a typical example.</p>

      <h2>Quick comparison</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Hardware BMS</th><th>Smart BMS</th></tr></thead>
        <tbody>
          <tr><td>Protection</td><td>Yes, fixed thresholds</td><td>Yes, often adjustable</td></tr>
          <tr><td>Phone monitoring</td><td>No</td><td>Yes, over Bluetooth</td></tr>
          <tr><td>Inverter or charger link</td><td>No</td><td>On models with RS485 or CAN</td></tr>
          <tr><td>Best for</td><td>Simple, low-cost packs</td><td>Solar, inverter, fleet and any pack you want to service</td></tr>
        </tbody>
      </table>

      <h2>Which should you choose?</h2>
      <p>Pick a smart BMS if the pack is expensive, sits in a hard-to-reach place, or will be serviced by someone else. Seeing one weak cell early saves a warranty claim. Pick a hardware BMS for small, cost-sensitive packs where nobody will look at the data. If you are unsure of the cell count, the <a href="${p(UNIV_100)}">Daly smart 7S-24S universal BMS</a> covers a range of series counts on one board.</p>
      <p>Size the current rating from your load as shown in our <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">BMS current rating guide</a>.</p>`,
    faq: [
      ['Is a smart BMS safer than a hardware BMS?', 'Both protect against the same basic faults. A smart BMS adds visibility and adjustable settings, which helps you catch problems early, but safe protection depends on the BMS being correctly rated and wired.'],
      ['Can I use a smart BMS without the phone app?', 'Yes. It protects the pack like any BMS. The app is optional and used for monitoring and settings.'],
      ['Does a smart BMS talk to every inverter?', 'No. Inverter communication depends on the protocol the inverter supports and the BMS model. Check the inverter manual and the BMS specification before ordering.'],
    ],
  }),

  mk({
    slug: 'lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide',
    category: 'BMS', tag: 'BMS Guide',
    title: 'LFP vs NMC BMS: How to Pick the Right Series Count for 12V, 48V and 72V Packs',
    short: ['LFP vs NMC BMS: Pick the Series Count', 'From 4S to 30S, matched to your voltage'],
    description: 'Learn how many cells in series (4S, 13S, 15S, 16S, 20S, 23S) you need for 12V, 48V and 72V lithium packs, and which Daly LFP or NMC BMS fits, with live prices from Arambhika.',
    keywords: 'LFP BMS series count, NMC BMS 13S, 15S LFP BMS India, 16S BMS, 23S BMS 72V, 30S BMS, Daly BMS selection',
    productsHeading: 'Daly LFP and NMC BMS by series count',
    intro: 'A BMS is built for one chemistry and one series count. Buy the wrong one and it will either refuse to work or protect at the wrong voltages. This guide turns your target pack voltage into the right "S" number.',
    body: `
      <h2>Start from the cell voltage</h2>
      <p>An LFP cell is about 3.2 V nominal and an NMC cell about 3.6 V nominal. Multiply by the number of cells in series (the "S" count) to get the pack voltage. The BMS must match both the chemistry and that count.</p>

      <h2>Common combinations</h2>
      <table class="blog-table">
        <thead><tr><th>Pack</th><th>LFP</th><th>NMC</th></tr></thead>
        <tbody>
          <tr><td>12 V class</td><td>4S (12.8 V)</td><td>3S or 4S</td></tr>
          <tr><td>24 V class</td><td>8S (25.6 V)</td><td>7S</td></tr>
          <tr><td>48 V class</td><td>15S (48 V) or 16S (51.2 V)</td><td>13S (46.8 V)</td></tr>
          <tr><td>72 V class</td><td>23S (73.6 V)</td><td>20S (72 V)</td></tr>
          <tr><td>96 V class</td><td>30S (96 V)</td><td>-</td></tr>
        </tbody>
      </table>

      <h2>Examples from the store</h2>
      <ul>
        <li>48 V LFP e-scooter or inverter: <a href="${p(SMART_15S)}">Daly LFP 15S 100A smart BMS</a></li>
        <li>72 V LFP e-rickshaw or heavy two-wheeler: <a href="${p(SMART_23S)}">Daly LFP 23S 100A smart BMS</a></li>
        <li>48 V NMC pack: <a href="${p(NMC_13S)}">Daly NMC 13S 60A smart BMS</a></li>
        <li>72 V NMC pack: <a href="${p(NMC_20S)}">Daly NMC 20S 40A smart BMS</a></li>
      </ul>

      <h2>Do not mix chemistries</h2>
      <p>An LFP BMS charges to a lower cut-off than an NMC BMS. Using an NMC board on LFP cells leaves charge unused, and an LFP board on NMC cells over-charges them, which is unsafe. Always buy the board that names your chemistry. For the full build steps see our <a href="/blog/build-48v-lithium-battery-pack-electric-scooter-india.html">48V scooter pack guide</a>.</p>`,
    faq: [
      ['How many cells in series for a 48V LFP pack?', 'Most 48 V LFP packs use 15S (about 48 V nominal) or 16S (about 51.2 V nominal). Check what your charger and controller are designed for.'],
      ['Can I use a 16S BMS on a 15S pack?', 'No. The BMS monitors each series group, so the cell count has to match the board.'],
      ['Is 13S NMC the same as 48V?', 'A 13S NMC pack is about 46.8 V nominal and is sold as a 48 V pack. Fully charged it sits near 54.6 V.'],
    ],
  }),

  mk({
    slug: 'daly-ess-active-balancing-bms-home-solar-battery-india',
    category: 'BMS', tag: 'Energy Storage',
    title: 'Daly ESS Active Balancing BMS for Home Solar Batteries in India',
    short: ['Active Balancing BMS for Home Solar', 'Why large LFP storage packs need it'],
    description: 'What active balancing does, why large 15S and 16S LFP home storage batteries benefit, and which Daly ESS smart BMS to choose for solar in India. Live prices from Arambhika, Noida.',
    keywords: 'active balancing BMS India, Daly ESS BMS, 16S LFP BMS home solar, 15S ESS BMS, solar battery BMS India',
    productsHeading: 'Daly ESS BMS with active balancing',
    intro: 'Large home storage batteries run for years and hold big cells, so tiny differences between cells add up. Active balancing moves charge between cells instead of burning it off as heat. Here is when it is worth paying for.',
    body: `
      <h2>Passive vs active balancing</h2>
      <p>A passive balancer bleeds the highest cells through small resistors until the rest catch up. It is simple and cheap, but the energy is lost as heat and the balancing current is small. An active balancer transfers energy from stronger cells to weaker ones, so balancing is faster and wastes little.</p>

      <h2>Why large cells make this matter</h2>
      <p>On big prismatic cells such as 280 Ah and 314 Ah, a small voltage difference can mean a large amount of charge to move. A bleed-only balancer may take a long time to correct it, especially if the pack rarely reaches full charge. That is common in solar systems that cycle in the middle of the range.</p>

      <h2>The ESS range</h2>
      <ul>
        <li><a href="${p(ESS_15S)}">Daly ESS 15S 100A smart BMS, active balancing</a> for 48 V class storage</li>
        <li><a href="${p(ESS_15S_150)}">Daly ESS 15S 150A smart BMS, active balancing</a> when the inverter draws more current</li>
        <li><a href="${p(ESS_16S)}">Daly ESS 16S 100A smart BMS (new model)</a> for 51.2 V storage packs</li>
      </ul>

      <h2>Match it to the inverter</h2>
      <p>Check three things before you order: the series count matches your cells, the continuous current covers your inverter's peak draw, and the communication port suits your inverter. Pair the BMS with matched cells, for example the <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah 16S build</a>, and bolted busbar.</p>`,
    faq: [
      ['Do I need active balancing for a small battery?', 'Not usually. For small packs with few cells, normal balancing is often enough. Active balancing pays off on large cells and long-life storage.'],
      ['Is 15S or 16S better for solar storage?', 'Both are used. 16S gives about 51.2 V and is widely used with 48 V class inverters. 15S gives about 48 V. Follow your inverter manufacturer\'s recommended range.'],
      ['Will the BMS balance during discharge?', 'That depends on the model and its settings. Check the specification of the exact board you choose.'],
    ],
  }),

  mk({
    slug: 'how-to-choose-bms-current-rating-lithium-battery-pack',
    category: 'BMS', tag: 'BMS Guide',
    title: 'How to Choose the Right BMS Current Rating for a Lithium Battery Pack',
    short: ['Choosing a BMS Current Rating', 'Continuous, peak and the safety margin'],
    description: 'Work out the BMS amp rating you need from motor or inverter power and pack voltage, with worked examples. Compare Daly 40A, 60A, 100A and 150A options with live prices from Arambhika.',
    keywords: 'BMS current rating, how many amps BMS, 60A vs 100A BMS, BMS for e-scooter, BMS for inverter, Daly BMS amp rating',
    productsHeading: 'Daly BMS in 40A to 150A ratings',
    intro: 'The most common BMS mistake is an undersized current rating. A board that trips under load, or runs hot all day, is usually too small for the job. The sum is simple.',
    body: `
      <h2>The formula</h2>
      <p>Current in amps equals power in watts divided by pack voltage. Use the peak power your motor or inverter can draw, not the label figure for normal running, then add a margin for start-up surges and heat.</p>

      <h2>Worked examples</h2>
      <table class="blog-table">
        <thead><tr><th>Load</th><th>Pack</th><th>Current</th><th>BMS to consider</th></tr></thead>
        <tbody>
          <tr><td>1.5 kW inverter</td><td>12.8 V (4S LFP)</td><td>about 117 A</td><td>Higher than 100 A, so use a larger board or a 24 V pack</td></tr>
          <tr><td>1.5 kW inverter</td><td>51.2 V (16S LFP)</td><td>about 29 A</td><td>A 60 A or 100 A board has comfortable margin</td></tr>
          <tr><td>2 kW e-scooter motor</td><td>48 V (15S LFP)</td><td>about 42 A</td><td><a href="${p(SMART_15S)}">15S 100A</a> keeps margin</td></tr>
          <tr><td>5 kW motor</td><td>73.6 V (23S LFP)</td><td>about 68 A</td><td><a href="${p(SMART_23S)}">23S 100A</a></td></tr>
        </tbody>
      </table>
      <p>The figures are simple power divided by nominal voltage. Real current rises as voltage sags, so leave headroom.</p>

      <h2>Why a bigger BMS is not wasteful</h2>
      <p>A BMS running near its limit warms up and ages faster. Choosing the next rating up costs little compared with a nuisance trip on a hill or a cloudy-day inverter surge. For 12 V packs with heavy loads, compare the <a href="${p(SMART_4S)}">4S 100A</a> with a higher voltage design. The universal <a href="${p(UNIV_100)}">7S-24S 100A board</a> also suits lower-power packs of many sizes.</p>

      <h2>Do not forget the wiring</h2>
      <p>The BMS rating means little if the strip or busbar between cells overheats first. Check our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing guide</a> as well.</p>`,
    faq: [
      ['How many amps BMS do I need for 1000W?', 'At 48 V, 1000 W is about 21 A, so a 40 A to 60 A board gives margin. At 12 V the same load is about 83 A, which needs a 100 A class board or more.'],
      ['Is the peak or continuous rating more important?', 'Both. Choose the continuous rating for your normal load and check that the BMS peak rating covers motor start-up or inverter surge.'],
      ['Can two BMS be used in parallel?', 'Do not parallel BMS boards on one pack unless the manufacturer says it is supported. Use a single higher-rated board instead.'],
    ],
  }),

  mk({
    slug: 'cell-holders-18650-21700-32650-battery-pack-guide',
    category: 'Cell Holder', tag: 'Pack Building',
    title: 'Cell Holders for 18650, 21700 and 32650 Battery Packs: Sizes and Uses',
    short: ['Cell Holders for Battery Packs', '18650, 21700, 32650 and larger sizes'],
    description: 'Why cell holders matter in battery packs, how the 1X2 holder sizes for 18650, 21700, 26650, 32650, 33140 and 34145 differ, and how they pair with nickel strip. Live prices from Arambhika.',
    keywords: 'cell holder 18650 India, 21700 cell holder, 32650 cell holder, battery pack cell holder, 1X2 cell holder',
    productsHeading: 'Cell holders by cell size',
    intro: 'A cell holder looks like a small plastic part, but it sets the spacing, keeps cells from shifting and makes welding straight. Here is how to choose one.',
    body: `
      <h2>What a holder does</h2>
      <p>Holders fix the cells at a set distance so the strip lines up with every terminal. They stop cells touching each other, give a little air gap, and reduce stress on welds when the pack is bumped. In compact packs they also make assembly faster and repeatable.</p>

      <h2>Pick by cell size</h2>
      <table class="blog-table">
        <thead><tr><th>Cell</th><th>Holder</th></tr></thead>
        <tbody>
          <tr><td>18650</td><td><a href="${p('CELL HOLDER 18650 (1X2)')}">Cell holder 18650 (1X2)</a></td></tr>
          <tr><td>21700</td><td><a href="${p('CELL HOLDER 21700 (1X2)')}">Cell holder 21700 (1X2)</a></td></tr>
          <tr><td>26650</td><td><a href="${p('CELL HOLDER 26650 (1X2)')}">Cell holder 26650 (1X2)</a></td></tr>
          <tr><td>32650</td><td><a href="${p('CELL HOLDER 32650 (1X2)')}">Cell holder 32650 (1X2)</a></td></tr>
          <tr><td>33140</td><td><a href="${p('CELL HOLDER 33140 (1X2)')}">Cell holder 33140 (1X2)</a></td></tr>
          <tr><td>34145</td><td><a href="${p('CELL HOLDER 34145 (1X2)')}">Cell holder 34145 (1X2)</a></td></tr>
        </tbody>
      </table>
      <p>The 1X2 format holds two cells side by side. Stack them to build the rows your layout needs.</p>

      <h2>Match the strip to the holder</h2>
      <p>The spacing between cell centres decides which strip fits. Many of our 2P strips are made to suit a holder, for example the <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 with holder with slit')}">21700 plated strip with holder</a>. Read how this works in our <a href="/blog/nickel-strip-centre-distance-cd-explained-match-strip-to-cell.html">centre distance guide</a>.</p>

      <h2>Mistakes to avoid</h2>
      <ul>
        <li>Buying holders and strip separately without checking the spacing.</li>
        <li>Mixing cell sizes in one holder row.</li>
        <li>Leaving no room for vents or cooling in tightly packed rows.</li>
      </ul>`,
    faq: [
      ['What does 1X2 mean on a cell holder?', 'It describes the layout: one row of two cells. Join holders together to form larger blocks.'],
      ['Do I need holders if I am spot-welding strip?', 'Not strictly, but they keep spacing even, make welding easier and give a more rigid pack. Most professional packs use them.'],
      ['Can a holder replace glue or tape?', 'Holders position the cells but you still need the pack case or wrap to keep it together. Follow your pack design.'],
    ],
  }),

  mk({
    slug: 'epoxy-sheet-insulation-battery-pack-thickness-guide',
    category: 'Epoxy Board', tag: 'Pack Building',
    title: 'Epoxy Sheet in Battery Packs: Uses, Thickness and How to Choose',
    short: ['Epoxy Sheet for Battery Packs', 'Insulation thickness and where to use it'],
    description: 'How epoxy sheet is used as insulation between cells, busbars and pack cases, how to choose 0.5, 0.8, 1 or 2 mm thickness, and where to buy it by the kg. Live prices from Arambhika.',
    keywords: 'epoxy sheet battery pack, epoxy board India, battery insulation sheet, epoxy sheet 2mm, battery pack insulation material',
    productsHeading: 'Epoxy sheets in several thicknesses',
    intro: 'Epoxy glass sheet is a stiff, flat insulator that can be cut to shape. Packs use it to keep metal parts apart and to protect cells from sharp edges. The right thickness depends on where it sits.',
    body: `
      <h2>Where it is used</h2>
      <ul>
        <li>Between the busbar or strip and the pack case, so nothing can short to the metal.</li>
        <li>Under and over the cell block as a base and cover plate.</li>
        <li>Between cell groups where an extra barrier is needed.</li>
        <li>As a mounting plate for the BMS or fuse.</li>
      </ul>

      <h2>Choosing the thickness</h2>
      <table class="blog-table">
        <thead><tr><th>Thickness</th><th>Typical use</th><th>Product</th></tr></thead>
        <tbody>
          <tr><td>0.5 mm</td><td>Thin barrier, wrap, tight spaces</td><td><a href="${p('EPOXY SHEET (502*338*0.5MM)')}">Epoxy sheet 502x338x0.5 mm</a></td></tr>
          <tr><td>0.8 mm</td><td>Light separation between parts</td><td><a href="${p('EPOXY SHEET (502*338*0.8MM)')}">Epoxy sheet 502x338x0.8 mm</a></td></tr>
          <tr><td>1 mm</td><td>General base or cover plate</td><td><a href="${p('EPOXY SHEET (502*338*1MM)')}">Epoxy sheet 502x338x1 mm</a></td></tr>
          <tr><td>2 mm</td><td>Stiffer mounting plate</td><td><a href="${p('EPOXY SHEET (502*338*2MM)')}">Epoxy sheet 502x338x2 mm</a></td></tr>
        </tbody>
      </table>
      <p>For large flat pieces there is also a longer <a href="${p('EPOXY SHEET (512*1225*0.5MM)')}">512x1225x0.5 mm sheet</a>.</p>

      <h2>Cutting and handling</h2>
      <p>Cut with a fine blade or saw and wear a dust mask, since fibre dust is an irritant. Deburr the edges so they do not nick wires or cells. Check your pack design and the voltage it carries to confirm the thickness gives enough insulation.</p>

      <h2>Pair it with the rest of the pack</h2>
      <p>Epoxy sheet works alongside <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">cell holders</a> and <a href="/blog/silicone-potting-compound-battery-pack-bms-protection-india.html">potting compound</a> to make a clean, safe assembly.</p>`,
    faq: [
      ['Is epoxy sheet sold by weight?', 'Yes, our epoxy sheets are priced per kg. The listing shows the sheet size so you can work out how many sheets a kg covers.'],
      ['Which thickness should I start with?', 'Many builders keep 0.5 mm for wrapping and 1 mm for base plates. Your design and voltage decide the final choice.'],
      ['Can I drill epoxy sheet?', 'Yes, with sharp bits and support underneath to avoid chipping. Use a dust mask.'],
    ],
  }),

  mk({
    slug: 'silicone-potting-compound-battery-pack-bms-protection-india',
    category: 'Potting Compound', tag: 'Pack Building',
    title: 'Silicone Potting Compound for Battery Packs and BMS Boards',
    short: ['Potting Compound for Battery Packs', 'Protect BMS boards from moisture and vibration'],
    description: 'How a two-part thermally conductive silicone potting gel protects BMS boards and connections from moisture, dust and vibration in Indian conditions. Mixing basics and live price from Arambhika.',
    keywords: 'silicone potting compound India, battery potting compound, thermally conductive gel, BMS potting, two part silicone potting',
    productsHeading: 'Two-part silicone potting compound',
    intro: 'Packs for scooters, rickshaws and outdoor lighting face water, dust and vibration. Potting fills the space around electronics with a flexible compound so those things cannot get in.',
    body: `
      <h2>What potting does</h2>
      <p>A potting compound is poured over a board or connection and cures into a protective block. It keeps out moisture and dust, holds components against vibration and can help move heat away from parts that warm up. A silicone gel stays soft, so it protects without stressing the parts.</p>

      <h2>The product</h2>
      <p>Our <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">two-part silicone potting compound</a> is a thermally conductive gel with a 1:1 mix ratio. Mixing equal parts makes it easy to measure. It is sold per kg.</p>

      <h2>How to use it</h2>
      <ol>
        <li>Clean and dry the board and housing. Remove dust and flux.</li>
        <li>Mix the two parts in the ratio on the pack label, stirring slowly to avoid air bubbles.</li>
        <li>Pour into the housing and let it settle. Tap gently to release trapped air.</li>
        <li>Allow the full cure time on the datasheet before handling or powering up.</li>
      </ol>
      <p>Test on a spare board first. Potted parts are hard to repair, so keep test points and any parts you may need to replace out of the pour.</p>

      <h2>Where it makes sense</h2>
      <ul>
        <li>BMS boards in vibration-prone vehicles such as e-rickshaws and scooters.</li>
        <li>Outdoor packs such as <a href="/blog/solar-street-light-off-grid-lighting-battery-pack-nickel-strip.html">solar street lights</a>.</li>
        <li>Connection points where water ingress is a risk.</li>
      </ul>
      <p>Potting is not a substitute for a good enclosure. Use it with a sealed case and sound wiring, and with a <a href="${p(SMART_15S)}">smart BMS</a> you can still monitor over Bluetooth.</p>`,
    faq: [
      ['What does 1:1 mean on potting compound?', 'It means the two parts are mixed in equal amounts. Check the datasheet to see whether that is by weight or by volume.'],
      ['Can I remove potted electronics later?', 'Silicone gel is easier to cut away than rigid epoxy, but repair is still difficult. Plan accordingly.'],
      ['Is potting required by law?', 'Requirements depend on your product and its standards. Check them for your pack type before deciding.'],
    ],
  }),
]
