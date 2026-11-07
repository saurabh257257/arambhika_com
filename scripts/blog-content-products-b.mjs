// Product-led posts, part B: busbars, prismatic LFP cells, cylindrical LFP and NMC cells.
import { p, mk } from './blog-products-lib.mjs'

const AL_SERIES = 'Aluminium Busbar Model 1 C2C Series'
const AL_PARALLEL = 'Aluminium Busbar Model 1 C2C Parallel'
const AL_L = 'Aluminium Busbar Model 1 C2C L Shape'
const CU_55 = 'COPPER BUS BAR Universal (55x20x2mm) - Tin Coated'
const CU_60 = 'COPPER BUS BAR Universal (60x20x2mm) - Tin Coated'
const CU_68 = 'COPPER BUS BAR Universal (68x20x2mm)- Tin Coated'
const CU_82 = 'COPPER BUS BAR Universal (82x20x2mm)- Tin Coated'
const HS314 = 'Highstar - 314Ah 3.2V Prismatic Cell'
const GP314 = 'GreatPower - 314Ah Prismatic Cell'
const GF314 = 'Ganfeng - 314Ah Laser Weld Prismatic Cell'
const CALB280 = 'CALB 3.2V - 280Ah Prismatic Cell'
const GP230 = 'GreatPower 3.2V - 230Ah Prismatic Cell'
const BAK100 = 'BAK LFP CELL 3.2V 100Ah'
const HP100 = 'High Power - 100Ah Prismatic Cell'
const TN100 = 'TIANNENG 3.2V - 100Ah Prismatic Cell'
const GP150 = 'GREATPOWER LFP CELL 3.2V 150Ah'
const GF150 = 'Ganfeng - 150Ah Laser Weld Prismatic Cell'
const SMART_4S = 'DALY LFP 4S-100AMP SMART BMS'
const ESS_16S = 'DALY ESS 16S - 100AMP SMART BMS (New Model)'

export const posts = [
  mk({
    slug: 'aluminium-busbar-cell-to-cell-series-parallel-l-shape-guide',
    category: 'Aluminium Busbar', tag: 'Busbars',
    title: 'Aluminium Busbar for Cell-to-Cell Connections: Series, Parallel and L-Shape',
    short: ['Aluminium Busbar Guide', 'Series, parallel and L-shape cell links'],
    description: 'How the Model 1 C2C aluminium busbars connect prismatic cells in series, in parallel and around corners, what to prepare before bolting, and live prices from Arambhika, Noida.',
    keywords: 'aluminium busbar India, aluminium busbar prismatic cell, C2C busbar, battery busbar series parallel, L shape busbar',
    productsHeading: 'Model 1 C2C aluminium busbars',
    intro: 'Aluminium busbars are a lightweight, low-cost way to link large prismatic cells. The Model 1 C2C range comes in three shapes, each for a different connection.',
    body: `
      <h2>The three shapes</h2>
      <table class="blog-table">
        <thead><tr><th>Busbar</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td><a href="${p(AL_SERIES)}">Model 1 C2C Series</a></td><td>Links the positive of one cell to the negative of the next, building voltage</td></tr>
          <tr><td><a href="${p(AL_PARALLEL)}">Model 1 C2C Parallel</a></td><td>Joins like terminals of cells side by side, building capacity</td></tr>
          <tr><td><a href="${p(AL_L)}">Model 1 C2C L Shape</a></td><td>Turns a corner or reaches the pack output where a straight bar will not fit</td></tr>
        </tbody>
      </table>

      <h2>Prepare the joint</h2>
      <ol>
        <li>Clean the cell terminal and the busbar contact face, removing oil and the dull oxide layer.</li>
        <li>Fit the busbar flat so the whole contact area touches the terminal.</li>
        <li>Tighten to the torque the cell maker specifies, and mark each bolt once done.</li>
        <li>Re-check after the first few charge cycles, since joints can settle.</li>
      </ol>

      <h2>Why aluminium needs care</h2>
      <p>Aluminium forms an oxide film quickly, and when it touches a different metal in damp air it can corrode. If your cell terminal is a different metal, use the hardware the cell maker recommends and keep the joint dry and tight. Your design and the cell datasheet decide the right combination.</p>

      <h2>When to choose copper instead</h2>
      <p>Aluminium carries less current than copper of the same size. For high-current packs see the <a href="/blog/copper-vs-aluminium-busbar-battery-pack-which-to-choose.html">copper vs aluminium comparison</a> and our <a href="/blog/copper-busbar-battery-ess-india.html">tin-coated copper busbar guide</a>.</p>`,
    faq: [
      ['What does C2C mean?', 'It stands for cell to cell: the busbar is designed to connect one cell to another.'],
      ['Can I weld aluminium busbar to the cell?', 'Some prismatic cells are laser welded, others are bolted. Follow the cell maker for the method it supports.'],
      ['Do I need anti-oxidation paste?', 'Many builders use a contact compound on aluminium joints. Follow the cell and busbar maker\'s guidance for your build.'],
    ],
  }),

  mk({
    slug: 'copper-vs-aluminium-busbar-battery-pack-which-to-choose',
    category: 'Copper Bus Bar,Aluminium Busbar', tag: 'Busbars',
    title: 'Copper vs Aluminium Busbar for Battery Packs: Which Should You Choose?',
    short: ['Copper vs Aluminium Busbar', 'Current, weight, cost and corrosion compared'],
    description: 'Compare tin-coated copper and aluminium busbar for lithium battery packs on conductivity, weight, cost, corrosion and joint reliability. Live prices from Arambhika, Noida.',
    keywords: 'copper vs aluminium busbar, tin coated copper busbar India, aluminium busbar battery, busbar material choice, LFP busbar',
    productsHeading: 'Copper and aluminium busbars',
    intro: 'Both metals carry current well and both are used in packs. The better choice depends on how much current you draw, how much weight and cost matter, and how the joints are made.',
    body: `
      <h2>Side by side</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Tin-coated copper</th><th>Aluminium</th></tr></thead>
        <tbody>
          <tr><td>Conductivity</td><td>Higher</td><td>Lower, so more cross-section is needed for the same current</td></tr>
          <tr><td>Weight</td><td>Heavier</td><td>Lighter</td></tr>
          <tr><td>Corrosion</td><td>Tin coating protects the surface</td><td>Oxide forms quickly, so joint prep matters</td></tr>
          <tr><td>Joint with large cell terminals</td><td>Bolted and widely used</td><td>Bolted or laser welded depending on cell</td></tr>
        </tbody>
      </table>

      <h2>Our copper options</h2>
      <p>The universal tin-coated copper bars are 20 mm wide and 2 mm thick, in four lengths: <a href="${p(CU_55)}">55 mm</a>, <a href="${p(CU_60)}">60 mm</a>, <a href="${p(CU_68)}">68 mm</a> and <a href="${p(CU_82)}">82 mm</a>. Pick the length that spans your cell-to-cell distance.</p>

      <h2>Our aluminium options</h2>
      <p>The Model 1 C2C range covers <a href="${p(AL_SERIES)}">series</a>, <a href="${p(AL_PARALLEL)}">parallel</a> and <a href="${p(AL_L)}">L-shape</a> links. See the <a href="/blog/aluminium-busbar-cell-to-cell-series-parallel-l-shape-guide.html">aluminium busbar guide</a> for details.</p>

      <h2>A simple rule</h2>
      <p>If current is high, packs are compact and long life matters most, copper is the safe default. If weight and cost lead and the current is moderate, aluminium of enough size can work. Always size the busbar for your continuous and peak current and confirm joint temperature in testing.</p>`,
    faq: [
      ['Is copper busbar always better?', 'It carries more current for the same size and resists joint problems well, but it costs more and weighs more. The best choice depends on your design.'],
      ['Why is copper tin coated?', 'The coating protects the copper from oxidising and gives a stable surface for bolted joints.'],
      ['Can I mix copper and aluminium in one pack?', 'It is possible but dissimilar metals can corrode at the joint in damp air. Avoid direct contact unless the design handles it.'],
    ],
  }),

  mk({
    slug: '314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build',
    category: 'Prismatic Cells', tag: 'Energy Storage',
    title: 'Building a 51.2V 314Ah LFP Home Energy Storage Battery: Parts List',
    short: ['Build a 51.2V 314Ah Storage Battery', 'Cells, BMS and busbar for a 16 kWh pack'],
    description: 'A parts-led guide to a 16S 314Ah LFP home energy storage battery in India: capacity maths, which cells and BMS to pair, busbar and assembly notes. Live prices from Arambhika.',
    keywords: '314Ah LFP cell India, 16S 51.2V battery build, home energy storage battery, 16 kWh LFP, prismatic LFP cell buy',
    productsHeading: '314Ah prismatic LFP cells',
    readTime: 6,
    intro: 'The 314Ah prismatic LFP cell has become the standard building block for home and small commercial storage. Sixteen in series gives a 51.2 V battery that suits most 48 V class inverters.',
    body: `
      <h2>The capacity maths</h2>
      <p>One cell is 3.2 V nominal. Sixteen in series (16S) gives 51.2 V. At 314 Ah, that is about 51.2 x 314 = 16,077 Wh, or roughly 16 kWh of nominal energy. Usable energy is a little less once you leave margin at the top and bottom of the charge.</p>

      <h2>Choosing the cells</h2>
      <p>We list 314Ah cells from several makers, including <a href="${p(HS314)}">Highstar</a>, <a href="${p(GP314)}">GreatPower</a> and <a href="${p(GF314)}">Ganfeng (laser weld)</a>. Buy all 16 cells from one batch, with matching voltage and internal resistance, so the pack balances well. For smaller systems, see the <a href="${p(CALB280)}">CALB 280Ah</a> and <a href="${p(GP230)}">GreatPower 230Ah</a> options.</p>

      <h2>The rest of the bill of materials</h2>
      <ul>
        <li>BMS: a 16S board such as the <a href="${p(ESS_16S)}">Daly ESS 16S 100A smart BMS</a>. See why in our <a href="/blog/daly-ess-active-balancing-bms-home-solar-battery-india.html">active balancing guide</a>.</li>
        <li>Busbar: <a href="/blog/copper-vs-aluminium-busbar-battery-pack-which-to-choose.html">copper or aluminium</a> links sized for the inverter current.</li>
        <li>Insulation: <a href="/blog/epoxy-sheet-insulation-battery-pack-thickness-guide.html">epoxy sheet</a> between the cell block and the case.</li>
        <li>Fuse, main breaker and a rigid enclosure.</li>
      </ul>

      <h2>Assembly notes</h2>
      <ol>
        <li>Check each cell's voltage. Top-balance them in parallel before building the series string.</li>
        <li>Compress the cells within the range the cell maker specifies, since LFP cells swell with use.</li>
        <li>Torque busbar bolts evenly and record the values.</li>
        <li>Charge and discharge slowly for the first cycles while watching cell voltages on the BMS app.</li>
      </ol>`,
    faq: [
      ['How many kWh is a 16S 314Ah pack?', 'About 16 kWh nominal (51.2 V x 314 Ah). Usable energy depends on the depth of discharge you allow.'],
      ['Do I need to compress prismatic cells?', 'Cell makers usually specify a compression range to keep cells flat over life. Follow the datasheet for the exact cell you buy.'],
      ['Can I build a 24V or 12V pack from 314Ah cells?', 'Yes, with 8S (25.6 V) or 4S (12.8 V). Current rises as voltage falls, so check the BMS and busbar rating.'],
    ],
  }),

  mk({
    slug: '100ah-150ah-lfp-prismatic-cells-e-rickshaw-inverter-battery-india',
    category: 'Prismatic Cells', tag: 'LFP Cells',
    title: '100Ah and 150Ah LFP Prismatic Cells for E-Rickshaw, Inverter and Solar Batteries',
    short: ['100Ah and 150Ah LFP Prismatic Cells', 'Where mid-size cells are the right fit'],
    description: 'When 100Ah and 150Ah prismatic LFP cells beat larger cells: e-rickshaw, UPS and small solar batteries, series-parallel layouts and lead-acid replacement. Live prices from Arambhika.',
    keywords: '100Ah LFP cell India, 150Ah prismatic cell, LFP cell e-rickshaw, inverter lithium battery build, lead acid replacement LFP',
    productsHeading: '100Ah and 150Ah prismatic LFP cells',
    intro: 'Not every project needs a 314Ah cell. Mid-size cells give flexible pack voltages and capacities for vehicles and smaller backup systems.',
    body: `
      <h2>Why choose 100Ah or 150Ah</h2>
      <ul>
        <li>Smaller cells let you shape voltage and capacity with less over-sizing.</li>
        <li>They are easier to carry and fit into tight vehicle battery boxes.</li>
        <li>A series-parallel layout lets you reach the capacity you need from small increments.</li>
      </ul>

      <h2>Examples</h2>
      <table class="blog-table">
        <thead><tr><th>Layout</th><th>Pack</th><th>Nominal energy</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>4S x 100Ah</td><td>12.8 V</td><td>about 1.3 kWh</td><td>12 V backup, replacing lead-acid</td></tr>
          <tr><td>8S x 100Ah</td><td>25.6 V</td><td>about 2.6 kWh</td><td>24 V inverter</td></tr>
          <tr><td>16S x 150Ah</td><td>51.2 V</td><td>about 7.7 kWh</td><td>Home storage</td></tr>
          <tr><td>23S x 100Ah</td><td>73.6 V</td><td>about 7.4 kWh</td><td>E-rickshaw, heavy EV</td></tr>
        </tbody>
      </table>

      <h2>Cells we stock</h2>
      <p>For 100Ah: <a href="${p(BAK100)}">BAK 3.2V 100Ah</a>, <a href="${p(HP100)}">High Power 100Ah</a> and <a href="${p(TN100)}">Tianneng 100Ah</a>. For 150Ah: <a href="${p(GP150)}">GreatPower 150Ah</a> and <a href="${p(GF150)}">Ganfeng 150Ah laser weld</a>.</p>

      <h2>Practical tips</h2>
      <p>Pair the pack with a BMS matched to the series count; see the <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">series count guide</a>. For vehicles, plan secure mounting and read our <a href="/blog/e-rickshaw-e-auto-battery-pack-nickel-strip-busbar-india.html">e-rickshaw pack guide</a>.</p>`,
    faq: [
      ['Can 100Ah cells be paralleled?', 'Yes, for more capacity. Match the cells, connect them with equal-length busbar, and use a BMS rated for the total current.'],
      ['Are LFP cells a drop-in for a lead-acid battery?', 'A 4S LFP pack is about 12.8 V, which suits many 12 V systems, but the charger and any alternator must support lithium charging.'],
      ['Which brand is best?', 'We list several makers. Choose by availability, price and the matching you can do within one batch.'],
    ],
  }),

  mk({
    slug: 'build-12v-100ah-lfp-battery-replace-lead-acid-inverter-india',
    category: 'Prismatic Cells,BMS,Copper Bus Bar', tag: 'How-To',
    title: 'Build a 12V 100Ah LFP Battery to Replace a Lead-Acid Battery',
    short: ['Build a 12V 100Ah LFP Battery', 'Four cells, a BMS and busbar, step by step'],
    description: 'Step-by-step build of a 12.8V 100Ah LFP battery from four prismatic cells, a 4S BMS and copper busbar. Parts list and tips for Indian users. Live prices from Arambhika, Noida.',
    keywords: 'build 12V LFP battery, 12V 100Ah lithium battery DIY India, 4S LFP BMS, lithium replace lead acid inverter, LFP busbar',
    productsHeading: 'Cells, BMS and busbar for a 12V pack',
    readTime: 6,
    intro: 'A 12.8 V LFP pack of four 100Ah cells holds about 1.3 kWh and weighs far less than a lead-acid battery of similar capacity. Here is the build.',
    body: `
      <h2>Parts list</h2>
      <ul>
        <li>4 prismatic LFP cells, 100Ah, from one batch: for example <a href="${p(BAK100)}">BAK 100Ah</a> or <a href="${p(TN100)}">Tianneng 100Ah</a></li>
        <li>BMS: <a href="${p(SMART_4S)}">Daly LFP 4S 100A smart BMS</a> (or the <a href="${p('DALY LFP 4S-100AMP HARDWARE BMS')}">hardware version</a>)</li>
        <li>Tin-coated copper busbar: <a href="${p(CU_60)}">60 mm bars</a> or the length your cell spacing needs</li>
        <li>Insulation and a case, with a main fuse and cable of suitable size</li>
      </ul>

      <h2>Steps</h2>
      <ol>
        <li><strong>Check the cells.</strong> Measure each cell's voltage. Connect them in parallel for several hours so all start at the same level.</li>
        <li><strong>Arrange them.</strong> Stack the four cells with the compression the maker recommends, with insulation between cells if the cases are conductive.</li>
        <li><strong>Connect in series.</strong> Link the positive of each cell to the negative of the next with busbar. Torque the bolts evenly.</li>
        <li><strong>Add the BMS.</strong> Wire the balance leads to the cells in the order the BMS manual shows. Connect the main negative last.</li>
        <li><strong>Test.</strong> Check the total voltage (about 12.8 V at rest), then run a gentle charge and discharge while watching cell voltages.</li>
      </ol>

      <h2>Check before you rely on it</h2>
      <p>Confirm that your inverter or charger can charge lithium within the pack's voltage range. See how to size the wiring in our <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">BMS current rating guide</a>, and why 12 V with high loads draws large current.</p>`,
    faq: [
      ['Is a 12V 100Ah LFP battery equal to a 100Ah lead-acid battery?', 'It holds more usable energy, because LFP can be discharged much deeper than lead-acid. Compare usable watt-hours rather than amp-hours alone.'],
      ['Do I need a special charger?', 'Use a charger with an LFP profile, or one whose settings you can set to the right voltages for four LFP cells in series.'],
      ['Is it safe to build my own?', 'It needs care: clean joints, correct wiring order, proper fusing and a rated BMS. If unsure, use a qualified pack builder.'],
    ],
  }),

  mk({
    slug: 'lfp-32140-cylindrical-cells-ess-ev-india-buying-guide',
    category: 'LFP Cylindrical Cells', tag: 'LFP Cells',
    title: 'LFP 32140 Cylindrical Cells (15Ah): Buying Guide for ESS and EV Packs',
    short: ['LFP 32140 Cylindrical Cells', 'A 15Ah cell for compact ESS and EV packs'],
    description: 'What a 32140 LFP cylindrical cell is, how its 15Ah, 3.2V rating builds packs, ESS and EV grade options, and the strip you need to connect them. Live prices from Arambhika.',
    keywords: 'LFP 32140 cell India, 32140 15Ah, cylindrical LFP cell, ESS grade LFP cell, 3.2V 15Ah LFP',
    productsHeading: '32140 LFP cylindrical cells',
    intro: 'The 32140 cell is a round LFP cell, 32 mm across and 140 mm long, rated 3.2 V and 15 Ah. It lets pack makers build LFP packs with the same spot-welded methods used for 18650 cells.',
    body: `
      <h2>Why use cylindrical LFP</h2>
      <ul>
        <li>Modular: build any voltage and capacity by series and parallel groups.</li>
        <li>Compact and sturdy, suited to portable and vehicle packs.</li>
        <li>Spot-welded with strip, so no bolted terminals to loosen.</li>
      </ul>

      <h2>Reading the grade</h2>
      <p>The listings name the intended use. <strong>ESS A-grade</strong> cells suit storage, with steady cycling. <strong>EV</strong> cells are meant for higher-rate use. Our range includes <a href="${p('JSK LFP CELL 32140 15 Ah ESS AGRADE')}">JSK ESS A-grade</a>, <a href="${p('LFP CELL 3.2V 15AH CNAE 32140 ESS A GRADE')}">CNAE ESS A-grade</a>, <a href="${p('MOCEAN LFP CELL 3.2V 15AH 32140')}">Mocean</a> and <a href="${p('CBAK LFP CELL 32140 15 Ah EV')}">CBAK EV</a>. Match the grade to your duty and check the datasheet's current rating.</p>

      <h2>Connecting the cells</h2>
      <p>These cells are joined with nickel strip made for the 32650 and 32140 size. Pure and plated options with holders are available, such as the <a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.15 mm CD 34.5 with holder with slit')}">32650 plated 2P strip</a>. Size the strip to the current as shown in our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing guide</a>. Check the strip's centre distance against your cell spacing; the <a href="/blog/nickel-strip-centre-distance-cd-explained-match-strip-to-cell.html">CD guide</a> explains how.</p>

      <h2>Example pack</h2>
      <p>A 16S pack gives about 51.2 V. With 4 cells in parallel per group (16S4P, 64 cells), capacity is 60 Ah, about 3 kWh nominal. Pair it with a 16S BMS, and see the <a href="/blog/lfp-battery-pack-solar-inverter-nickel-strip-busbar-india.html">LFP solar pack guide</a>.</p>`,
    faq: [
      ['What does 32140 mean?', 'The cell is about 32 mm in diameter and 140 mm long. Check the datasheet for the exact dimensions.'],
      ['Is 32140 the same as 32650?', 'No. 32650 is about 65 mm long. Both are 32 mm wide, which is why some strip and holders suit both. Check fit before ordering.'],
      ['Can I use pure nickel strip with LFP cells?', 'Yes. Pure nickel carries more current for the same size, which helps on higher-rate packs.'],
    ],
  }),

  mk({
    slug: '18650-vs-21700-nmc-cells-which-for-your-battery-pack',
    category: 'NMC Cylindrical Cells', tag: 'NMC Cells',
    title: '18650 vs 21700 NMC Cells: Which Should You Use for Your Battery Pack?',
    short: ['18650 vs 21700 NMC Cells', 'Capacity, cell count and cost compared'],
    description: 'Compare 18650 (2600 mAh) and 21700 (4500 mAh) NMC cells on energy per cell, cells needed, weld count and pack size. EV-grade options with live prices from Arambhika, Noida.',
    keywords: '18650 vs 21700, NMC cell India, 21700 4500mAh, 18650 2600mAh, lithium ion cell buy India, EV grade NMC cell',
    productsHeading: 'NMC 18650 and 21700 cells',
    intro: 'Both cells use similar chemistry, but a 21700 holds far more energy than an 18650. Fewer larger cells mean fewer welds and a simpler pack.',
    body: `
      <h2>The numbers</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>18650</th><th>21700</th></tr></thead>
        <tbody>
          <tr><td>Typical capacity (our range)</td><td>2600 mAh</td><td>4500 mAh</td></tr>
          <tr><td>Energy at 3.6 V</td><td>about 9.4 Wh</td><td>about 16.2 Wh</td></tr>
          <tr><td>Cells for 1 kWh</td><td>about 107</td><td>about 62</td></tr>
          <tr><td>Welds and strip length</td><td>More</td><td>Fewer</td></tr>
        </tbody>
      </table>

      <h2>Our cells</h2>
      <ul>
        <li>18650: <a href="${p('LITHIUM-ION CELL 2600 mAh DMEGC 18650')}">DMEGC 2600 mAh</a> and <a href="${p('NORDA NMC CELL 18650 2600 mAh EV GRADE')}">Norda 2600 mAh EV grade</a></li>
        <li>21700: <a href="${p('LITHIUM-ION CELL 4500 mAh DMEGC 21700')}">DMEGC 4500 mAh</a> and <a href="${p('NORDA NMC CELL 21700 4500 mAh')}">Norda 4500 mAh</a></li>
      </ul>

      <h2>How to decide</h2>
      <ul>
        <li>Choose <strong>21700</strong> when you want the most energy in the least space, with fewer parts to assemble.</li>
        <li>Choose <strong>18650</strong> when you need a smaller or more flexible shape, or you already use 18650 tooling and strip.</li>
        <li>Check the discharge rate in the datasheet, not only the capacity. A high-current pack may need more cells in parallel either way.</li>
      </ul>

      <h2>Matching strip and holders</h2>
      <p>Each size has its own strip and holder; see the <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">plated strip guide</a> and the <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">cell holder guide</a>. To build a full pack, follow the <a href="/blog/build-13s-nmc-48v-battery-pack-21700-cells-step-by-step.html">13S 48V build</a>.</p>`,
    faq: [
      ['Is a 21700 always better than an 18650?', 'It holds more energy per cell, but the best choice depends on space, current needs and your tooling.'],
      ['What does EV grade mean?', 'It indicates a cell offered for higher-rate vehicle use. Always read the datasheet for the actual continuous and peak current rating.'],
      ['Can I mix 18650 and 21700 in one pack?', 'No. Different sizes need different holders and strip, and different cell types should not be mixed in a series string.'],
    ],
  }),
]
