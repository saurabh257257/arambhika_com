// Product-led posts, part C: nickel strip types, a 13S NMC build, a full bill of materials and a cell buying checklist.
import { p, mk } from './blog-products-lib.mjs'

const NMC_13S = 'DALY NMC 13S-60AMP SMART BMS'
const CELL_21700 = 'LITHIUM-ION CELL 4500 mAh DMEGC 21700'
const NORDA_21700 = 'NORDA NMC CELL 21700 4500 mAh'
const P21700_HOLDER = 'Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 with holder with slit'
const PURE21700 = 'Nickel Strip Pure 2P(21700) 31x0.15 mm CD 22.5 with holder'

export const posts = [
  mk({
    slug: 'build-13s-nmc-48v-battery-pack-21700-cells-step-by-step',
    category: 'NMC Cylindrical Cells,Nickel Strip Plated,Cell Holder,BMS', tag: 'How-To',
    title: 'Build a 13S 48V NMC Battery Pack with 21700 Cells, Step by Step',
    short: ['Build a 13S 48V 21700 Pack', 'Cells, holders, strip and BMS, in order'],
    description: 'Build a 13S4P 48V NMC battery pack from 21700 cells: capacity maths, holders, 2P nickel strip, Daly NMC BMS and assembly order. Live prices from Arambhika, Noida.',
    keywords: 'build 48V lithium battery pack, 13S NMC pack, 21700 battery pack DIY India, 13S4P battery, Daly NMC BMS',
    productsHeading: 'Parts for a 13S 21700 pack',
    readTime: 6,
    intro: 'A 13S pack of NMC cells is the common 48 V build for e-bikes and scooters. With 21700 cells, four in parallel per group gives a useful 18 Ah pack.',
    body: `
      <h2>The maths</h2>
      <p>13 groups in series at 3.6 V nominal is 46.8 V (about 54.6 V fully charged). With four 4500 mAh cells in parallel per group (13S4P, 52 cells), the pack is 18 Ah, about 842 Wh nominal.</p>

      <h2>Parts list</h2>
      <ul>
        <li>52 cells, all from one batch: <a href="${p(CELL_21700)}">DMEGC 4500 mAh</a> or <a href="${p(NORDA_21700)}">Norda 4500 mAh</a></li>
        <li>Holders: <a href="${p('CELL HOLDER 21700 (1X2)')}">21700 1X2 cell holders</a></li>
        <li>Strip: <a href="${p(P21700_HOLDER)}">plated 2P 21700 strip with holder</a>, or <a href="${p(PURE21700)}">pure nickel</a> for higher current</li>
        <li>BMS: <a href="${p(NMC_13S)}">Daly NMC 13S 60A smart BMS</a></li>
        <li>Insulation, fuse, output cable and a case</li>
      </ul>

      <h2>Assembly order</h2>
      <ol>
        <li><strong>Sort the cells.</strong> Measure voltage and keep all within a close range. Never mix batches or brands.</li>
        <li><strong>Fit the holders.</strong> Build the 4-cell parallel groups with matching orientation.</li>
        <li><strong>Weld the strip.</strong> Spot-weld each terminal with settings from test welds, as in our <a href="/blog/spot-weld-nickel-strip-18650-21700-battery-pack-guide.html">spot-welding guide</a>.</li>
        <li><strong>Add the BMS.</strong> Connect the balance leads in sequence, then the main leads, following the BMS manual.</li>
        <li><strong>Insulate and test.</strong> Cover exposed strip, close the case, then test charge and discharge slowly.</li>
      </ol>

      <h2>Check the current</h2>
      <p>Confirm the cell discharge rating times four, the strip size and the 60 A BMS all cover your motor's peak draw. See the <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">BMS rating guide</a>, and the broader <a href="/blog/build-48v-lithium-battery-pack-electric-scooter-india.html">48V scooter guide</a>.</p>`,
    faq: [
      ['What does 13S4P mean?', '13 cell groups in series, with 4 cells in parallel in each group. That is 52 cells in total.'],
      ['How far can this pack take a scooter?', 'It depends on the vehicle, load and riding. As a rough guide, 842 Wh at 25 Wh per km would be about 33 km. Treat it as an estimate only.'],
      ['Should I use plated or pure strip?', 'Plated is the economical choice for moderate current. Pure nickel carries more current for the same size, suiting higher loads.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-centre-distance-cd-explained-match-strip-to-cell',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Nickel Strip Centre Distance (CD) Explained: How to Match 2P Strip to Your Cell',
    short: ['Nickel Strip Centre Distance (CD)', 'Match 2P strip to 18650, 21700 and 32650'],
    description: 'What CD, 2P and the size codes in our nickel strip names mean, and how to match a 2P strip to 18650, 21700 and 32650 cells and holders. Live prices from Arambhika, Noida.',
    keywords: 'nickel strip CD meaning, 2P nickel strip, centre distance nickel strip, 18650 2P strip 26mm, 21700 strip 31mm, 32650 strip 46.5mm',
    productsHeading: '2P nickel strip by cell size',
    intro: 'Product names like "2P(21700) 31x0.15 mm CD 22.5 with holder" pack a lot of information into a few characters. Here is how to read them.',
    body: `
      <h2>Decoding the name</h2>
      <table class="blog-table">
        <thead><tr><th>Part</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>1P or 2P</td><td>Strip made to join one cell, or two cells side by side (parallel)</td></tr>
          <tr><td>(21700)</td><td>The cell size it is made for</td></tr>
          <tr><td>31x0.15 mm</td><td>Width x thickness of the strip</td></tr>
          <tr><td>CD 22.5</td><td>Centre distance: the spacing between cell centres, in mm</td></tr>
          <tr><td>with / without holder</td><td>Whether it suits a plastic cell holder layout</td></tr>
          <tr><td>with / without slit</td><td>Whether the strip has a slit cut in it</td></tr>
        </tbody>
      </table>

      <h2>Why CD matters</h2>
      <p>If the strip's centre distance does not match your cell spacing, the weld points will not land on the terminals. CD is a little more than the cell diameter. For example, 18650 strip uses CD 19, 21700 uses CD 22.5 or 23, and 32650 uses CD 32.8 or 34.5, depending on the holder or gap you are using.</p>

      <h2>Choosing by cell</h2>
      <ul>
        <li>18650: <a href="${p('Nickel Strip Plated 2P(18650) 26x0.15 mm CD 19')}">plated 26x0.15 CD 19</a> or <a href="${p('Nickel Strip Pure 2P(18650) 26x0.15 mm')}">pure 26x0.15</a></li>
        <li>21700: <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 23 with holder with slit')}">plated CD 23 with holder</a> or <a href="${p('Nickel Strip Pure 2P(21700) 31x0.15 mm CD 23 with holder')}">pure CD 23</a></li>
        <li>32650: <a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.15 mm CD 34.5 with holder with slit')}">plated CD 34.5 with holder</a> or <a href="${p('Nickel Strip Pure 2P(32650) 46.5x0.15 mm CD 34.5 with holder')}">pure CD 34.5</a></li>
      </ul>

      <h2>When in doubt</h2>
      <p>Measure the centre-to-centre spacing in your holder and send us a photo of your layout. Read the <a href="/blog/nickel-strip-types-slit-fuse-type-zig-zag-explained.html">strip type guide</a> to choose a design, and the <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">cell holder guide</a> for spacing.</p>`,
    faq: [
      ['What is the difference between 1P and 2P strip?', '1P strip is a plain strip used to join cells in whatever layout you need. 2P strip is pre-shaped to join two cells in parallel and link to the next group.'],
      ['What does CD stand for?', 'Centre distance, the spacing between the centres of two adjacent cells in the layout.'],
      ['Can I use CD 23 strip in a CD 22.5 holder?', 'Not without checking. A half-millimetre difference can move the weld point off the terminal. Match the CD to your holder.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-types-slit-fuse-type-zig-zag-explained',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Nickel Strip Types Explained: Slit, Fuse Type and Zig-Zag Strips',
    short: ['Slit, Fuse and Zig-Zag Nickel Strip', 'What each strip design is for'],
    description: 'What slit, fuse-type and zig-zag nickel strips are, how they differ from plain 1P and 2P strip, and how to choose between them for 18650, 21700 and 32650 packs. Live prices from Arambhika.',
    keywords: 'fuse type nickel strip, zig zag nickel strip, nickel strip with slit, 2P nickel strip types, pure nickel fuse strip',
    productsHeading: 'Slit, fuse-type and zig-zag strips',
    intro: 'Beyond plain strip, we sell shaped strips for particular packs. Each design solves a specific build problem.',
    body: `
      <h2>Plain strip (1P)</h2>
      <p>Straight strip in widths such as 6, 8 and 10 mm, in several thicknesses. You cut it to length and weld it where you need it. It is the most flexible option, for example <a href="${p('Nickel Strip Plated 1P 8x0.15 mm')}">plated 8x0.15</a> or <a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">pure 8x0.15</a>.</p>

      <h2>Slit and no-slit 2P strip</h2>
      <p>2P strip is pre-formed for two cells, and some versions come with a slit cut in the strip while others do not. See the pairs: <a href="${p('Nickel Strip Plated 2P(18650) 26x0.15 mm without slit')}">18650 without slit</a> and <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5 without holder with slit')}">21700 with slit</a>. The right choice depends on your welder and layout, so test a few joints before you buy in bulk.</p>

      <h2>Fuse-type strip</h2>
      <p>A fuse-type strip has a narrowed section between cells so that, if one cell draws a fault current, the narrow section is designed to open. It adds a layer of protection at cell level. Examples are <a href="${p('Nickel Strip Plated 2P(32650) 36.5x0.15 mm Fuse Type CD 22.5')}">plated fuse type</a> and <a href="${p('Nickel Strip Pure 2P(32650) 36.5x0.15 mm Fuse Type CD 22.5')}">pure fuse type</a>. It does not replace the main fuse or the BMS.</p>

      <h2>Zig-zag strip</h2>
      <p>Zig-zag strip is formed in a repeating shape for layouts that need it, such as the <a href="${p('Nickel Strip Pure 2P(18650) Zig Zag 19.01x0.15 mm')}">pure 18650 zig-zag</a>. Send us your layout if you are not sure it suits your pack.</p>

      <h2>Plated or pure?</h2>
      <p>Pure nickel conducts better than plated steel-core strip, so the same size handles more current. Plated is the lower-cost route. See the <a href="/blog/nickel-strip-price-per-kg-india-plated-vs-pure.html">plated vs pure price guide</a> and the <a href="/blog/nickel-strip-centre-distance-cd-explained-match-strip-to-cell.html">CD guide</a> to finish selecting.</p>`,
    faq: [
      ['Does a fuse-type strip replace a BMS?', 'No. It adds cell-level protection in certain faults, but the BMS and main fuse are still required.'],
      ['Are slit strips easier to weld?', 'It depends on your welder and settings. Run test welds on both before committing to a batch.'],
      ['Can I get a custom shape?', 'Message us on WhatsApp with a drawing and quantity and we will tell you what is possible.'],
    ],
  }),

  mk({
    slug: 'nickel-strip-thickness-0-15-0-20-0-30-mm-choose-for-current',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Nickel Strip Thickness: 0.15, 0.20 or 0.30 mm for Your Battery Pack?',
    short: ['Nickel Strip Thickness: 0.15, 0.20, 0.30', 'Pick by current and your spot welder'],
    description: 'How strip thickness and width set current capacity, and how to choose between 0.15, 0.20 and 0.30 mm plated or pure nickel strip for your pack and welder. Live prices from Arambhika.',
    keywords: 'nickel strip thickness, 0.15mm vs 0.30mm nickel strip, nickel strip current capacity, 10x0.30 nickel strip, spot welder nickel strip thickness',
    productsHeading: 'Nickel strip in 0.15 to 0.30 mm',
    intro: 'Thickness is the quickest way to raise the current a strip can carry, but a thicker strip also needs a more powerful welder. The trade-off decides the choice.',
    body: `
      <h2>The range</h2>
      <table class="blog-table">
        <thead><tr><th>Thickness</th><th>Typical use</th><th>Examples</th></tr></thead>
        <tbody>
          <tr><td>0.15 mm</td><td>Small and mid-current packs, light welders</td><td><a href="${p('Nickel Strip Plated 1P 10x0.15 mm')}">Plated 10x0.15</a>, <a href="${p('Nickel Strip Pure 1P 10x0.15 mm')}">pure 10x0.15</a></td></tr>
          <tr><td>0.20 mm</td><td>Higher-current packs</td><td><a href="${p('Nickel Strip Plated 1P 10x0.20 mm')}">Plated 10x0.20</a>, <a href="${p('Nickel Strip Pure 1P 10x0.20 mm')}">pure 10x0.20</a></td></tr>
          <tr><td>0.30 mm</td><td>Highest-current packs, stronger welders</td><td><a href="${p('Nickel Strip Plated 1P 10x0.30 mm')}">Plated 10x0.30</a>, <a href="${p('Nickel Strip Pure 1P 10x0.30 mm')}">pure 10x0.30</a></td></tr>
        </tbody>
      </table>

      <h2>Width matters too</h2>
      <p>Current capacity grows with cross-section: width times thickness. A 10 mm wide strip is wider than a 6 mm one at the same thickness, so a 10x0.15 strip can match a 6x0.25 strip. Pick width to suit the cell terminal and the number of weld points.</p>

      <h2>Your welder sets the limit</h2>
      <p>Thicker strip needs more weld energy. A small capacitor-discharge welder may weld 0.15 mm easily, struggle with 0.20 mm, and fail on 0.30 mm. Test welds and a pull test tell you more than any rule. See the troubleshooting steps in our <a href="/blog/battery-pack-heating-nickel-strip-weak-welds-troubleshooting.html">weak weld guide</a>.</p>

      <h2>Do the sum</h2>
      <p>Work out your continuous and peak current, then use the worked examples in our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing guide</a>. When current is very high, pure nickel or busbar may serve better than a single thick strip.</p>`,
    faq: [
      ['Is 0.30 mm strip always better?', 'It carries more current, but it needs a stronger welder and gives more heat at the joint. Use the thickness your current and welder require.'],
      ['Can I stack two thin strips instead of one thick one?', 'Some builders do. Test the weld quality, since stacked strip can be harder to weld reliably.'],
      ['Which is better for e-bikes?', 'It depends on the motor current and the cells. Many e-bike packs use 0.15 to 0.20 mm strip; high-power builds may need more.'],
    ],
  }),

  mk({
    slug: 'battery-pack-bill-of-materials-components-checklist-india',
    category: 'Nickel Strip Plated,BMS,Cell Holder,Epoxy Board', tag: 'Pack Building',
    title: 'Battery Pack Bill of Materials: Every Component You Need to Build a Lithium Pack',
    short: ['Battery Pack Bill of Materials', 'A checklist of every part, from cells to potting'],
    description: 'A complete checklist of components for a lithium battery pack in India: cells, nickel strip or busbar, cell holders, BMS, insulation and potting. Links to each product at Arambhika, Noida.',
    keywords: 'battery pack components list, lithium battery pack bill of materials, battery pack parts India, battery assembly checklist',
    productsHeading: 'Core battery pack components',
    readTime: 6,
    intro: 'Forgetting one small part stalls a build. Use this checklist to gather everything before you start.',
    body: `
      <h2>1. Cells</h2>
      <p>Choose by chemistry and size: <a href="${p(NORDA_21700)}">NMC 21700</a> or <a href="${p('NORDA NMC CELL 18650 2600 mAh EV GRADE')}">18650</a> for cylindrical packs, <a href="${p('JSK LFP CELL 32140 15 Ah ESS AGRADE')}">LFP 32140</a> for round LFP, or <a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">prismatic LFP</a> for storage and vehicles. Always buy a full pack's worth from one batch.</p>

      <h2>2. Connections</h2>
      <ul>
        <li>Spot-welded cylindrical packs: <a href="${p('Nickel Strip Plated 1P 10x0.15 mm')}">plated strip</a> or <a href="${p('Nickel Strip Pure 1P 10x0.15 mm')}">pure nickel strip</a></li>
        <li>Prismatic packs: <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">copper busbar</a> or <a href="${p('Aluminium Busbar Model 1 C2C Series')}">aluminium busbar</a></li>
      </ul>

      <h2>3. Structure</h2>
      <p><a href="${p('CELL HOLDER 21700 (1X2)')}">Cell holders</a> for cylindrical cells, plus an enclosure that suits your product.</p>

      <h2>4. Protection</h2>
      <p>A <a href="${p('DALY LFP 15S-100AMP SMART BMS')}">BMS</a> matched to chemistry, series count and current, plus a main fuse or breaker sized to the load.</p>

      <h2>5. Insulation and sealing</h2>
      <p><a href="${p('EPOXY SHEET (502*338*1MM)')}">Epoxy sheet</a> for barriers and base plates, and <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">potting compound</a> for electronics that face water or vibration.</p>

      <h2>6. Tools</h2>
      <ul>
        <li>Spot welder for strip (not needed for bolted busbar)</li>
        <li>Torque wrench for busbar bolts</li>
        <li>Multimeter, balance charger or tester</li>
        <li>Insulated tools, gloves and eye protection</li>
      </ul>

      <h2>Order it together</h2>
      <p>Most of these parts ship from our Noida warehouse in one order. Get a single quote on WhatsApp and see our <a href="/blog/how-to-choose-nickel-strip-copper-busbar-manufacturer-india.html">supplier checklist</a>.</p>`,
    faq: [
      ['Do I need a spot welder for every pack?', 'Only for strip-welded cylindrical packs. Prismatic cells use bolted or laser-welded busbar, so no spot welder is needed.'],
      ['What is the part people forget most?', 'The main fuse and insulation. A BMS alone is not a replacement for a correctly rated fuse and clean insulation.'],
      ['Can I buy everything from one place?', 'Yes. Cells, strip, busbar, holders, BMS, epoxy sheet and potting compound are all on our store.'],
    ],
  }),

  mk({
    slug: 'buying-lfp-prismatic-cells-india-checklist-matching-grade-testing',
    category: 'Prismatic Cells,LFP Cylindrical Cells', tag: 'LFP Cells',
    title: 'Buying LFP Cells in India: A Checklist for Grade, Matching and Testing',
    short: ['Buying LFP Cells: A Checklist', 'Grade, batch matching and incoming tests'],
    description: 'How to buy LFP prismatic and cylindrical cells in India with confidence: what grades mean, what to ask the supplier, batch matching and the tests to run on arrival. Cells at Arambhika, Noida.',
    keywords: 'buy LFP cells India, LFP cell grade A, prismatic cell buying guide, LFP cell testing, battery cell supplier India',
    productsHeading: 'LFP prismatic and cylindrical cells',
    intro: 'Cells are the largest cost in a pack, and a poor batch ruins everything built on top of it. These checks reduce the risk.',
    body: `
      <h2>Ask before you order</h2>
      <ul>
        <li>The maker and model, and the datasheet for that model.</li>
        <li>The grade being sold (for example A-grade or ESS grade) and what that means for the supplier.</li>
        <li>Whether all cells come from one production batch.</li>
        <li>Terminal type: bolted, laser-weld, and whether busbars are included.</li>
      </ul>

      <h2>Know the listings</h2>
      <p>For large cells, see the <a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">Highstar 314Ah</a> and <a href="${p('CALB 3.2V - 280Ah Prismatic Cell')}">CALB 280Ah</a>; for mid-size, <a href="${p('BAK LFP CELL 3.2V 100Ah')}">BAK 100Ah</a>; for round cells, <a href="${p('MOCEAN LFP CELL 3.2V 15AH 32140')}">Mocean 32140</a>. Pack variants such as "with packing" or "laser welding" change what you receive, so read each listing.</p>

      <h2>Tests on arrival</h2>
      <ol>
        <li><strong>Visual.</strong> Check for dents, leaks or damaged terminals.</li>
        <li><strong>Voltage.</strong> Measure every cell at rest. A wide spread suggests mixed batches or poor storage.</li>
        <li><strong>Internal resistance.</strong> Compare cells with the same meter; outliers should not share a pack.</li>
        <li><strong>Capacity.</strong> Run a controlled charge-discharge on a sample, or all cells if the pack is expensive.</li>
      </ol>

      <h2>Match, then build</h2>
      <p>Group cells by voltage and resistance, top-balance them in parallel, and only then assemble. Pair with a suitable BMS from the <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">series count guide</a>, and follow the <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">314Ah build guide</a> or the <a href="/blog/100ah-150ah-lfp-prismatic-cells-e-rickshaw-inverter-battery-india.html">mid-size cell guide</a>.</p>`,
    faq: [
      ['What does A-grade mean?', 'It is the supplier\'s grading term and is not a single universal standard. Ask for the datasheet and the test data behind the grade.'],
      ['Should I test every cell?', 'For expensive or critical packs, yes. At minimum, measure the voltage and internal resistance of every cell and capacity-test a sample.'],
      ['Can I mix cells bought at different times?', 'Avoid it. Different batches and ages age differently, which causes balancing problems. Build the whole pack from one batch.'],
    ],
  }),
]
