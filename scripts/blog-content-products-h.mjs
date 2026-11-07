// Product-led posts, part H: special nickel strips, welding, busbars, holders, epoxy, potting and heat.
import { p, mk } from './blog-products-lib.mjs'

export const posts = [
  mk({
    slug: 'zig-zag-nickel-strip-18650-pure-and-plated-when-to-use',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Zig-Zag Nickel Strip for 18650 Packs: Pure and Plated Versions and When to Use Them',
    short: ['Zig-Zag Nickel Strip for 18650', 'Pure and plated formed strip explained'],
    description: 'What zig-zag nickel strip is, which 18650 packs use it, and how the plated 0.15 mm and pure 0.15 and 0.30 mm versions differ. Send your layout for a fit check. Live prices from Arambhika, Noida.',
    keywords: 'zig zag nickel strip, zigzag nickel strip 18650, formed nickel strip India, pure nickel zig zag 0.30, battery pack strip shapes',
    productsHeading: 'Zig-zag nickel strips',
    intro: 'Most strip is straight. Zig-zag strip is stamped into a repeating shape for pack layouts that need it.',
    body: `
      <h2>The three zig-zag strips</h2>
      <ul>
        <li><a href="${p('Nickel Strip Plated 2P(18650) Zig Zag 0.15 mm')}">Plated 2P(18650) zig-zag 0.15 mm</a></li>
        <li><a href="${p('Nickel Strip Pure 2P(18650) Zig Zag 19.01x0.15 mm')}">Pure 2P(18650) zig-zag 19.01x0.15 mm</a></li>
        <li><a href="${p('Nickel Strip Pure 2P(18650) Zig Zag 26x0.30 mm')}">Pure 2P(18650) zig-zag 26x0.30 mm</a></li>
      </ul>
      <h2>Where a formed shape helps</h2>
      <p>Because the strip follows the layout of the cells, it can connect staggered or alternating rows with less cutting. It also gives repeatable weld positions, which helps when you build many identical packs.</p>
      <h2>Choosing among the three</h2>
      <table class="blog-table">
        <thead><tr><th>Need</th><th>Pick</th></tr></thead>
        <tbody>
          <tr><td>Lowest cost, light loads</td><td>Plated 0.15 mm</td></tr>
          <tr><td>Better conductivity, same thickness</td><td>Pure 0.15 mm</td></tr>
          <tr><td>High current</td><td>Pure 0.30 mm, with a welder that can handle it</td></tr>
        </tbody>
      </table>
      <h2>Fit check first</h2>
      <p>Specifications such as spacing differ between these formed strips and the standard 2P strip. Before ordering in bulk, send us a photo or drawing of your layout. Compare with the standard 18650 strips in our <a href="/blog/nickel-strip-plated-2p-18650-26mm-cd19-pack-guide.html">18650 guide</a>.</p>`,
    faq: [
      ['Does zig-zag strip weld differently?', 'The welding is the same process. Check that your electrodes reach every weld spot in the pattern.'],
      ['Is zig-zag stronger than flat strip?', 'The shape mainly helps layout and spacing. Current capacity still depends on cross-section.'],
      ['Can I get a custom shape?', 'Send us a drawing and quantity on WhatsApp and we will tell you what is possible.'],
    ],
  }),

  mk({
    slug: 'fuse-type-nickel-strip-32650-cell-level-protection-pure-and-plated',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Fuse-Type Nickel Strip for 32650 Cells: Cell-Level Protection Explained',
    short: ['Fuse-Type Nickel Strip for 32650', 'A built-in weak link for each cell'],
    description: 'How fuse-type nickel strip adds cell-level protection in 32650 and 32140 packs, what it does and does not do, and the plated and pure 36.5x0.15 mm options. Live prices from Arambhika, Noida.',
    keywords: 'fuse type nickel strip, 32650 fuse strip, cell level fuse battery, 36.5x0.15 nickel strip, parallel cell protection',
    productsHeading: 'Fuse-type nickel strip',
    intro: 'In a parallel group, one shorted cell can dump the current of its neighbours into a fault. A fuse-type strip is a way to isolate that cell.',
    body: `
      <h2>How it works</h2>
      <p>The strip has a narrowed section on the path to each cell. In normal use it carries the cell's current easily. If a cell goes into a short, the surge heats the narrow part until it opens, disconnecting that cell from the group.</p>
      <h2>The options</h2>
      <ul>
        <li><a href="${p('Nickel Strip Plated 2P(32650) 36.5x0.15 mm Fuse Type CD 22.5')}">Plated 2P(32650) 36.5x0.15 mm fuse type</a></li>
        <li><a href="${p('Nickel Strip Pure 2P(32650) 36.5x0.15 mm Fuse Type CD 22.5')}">Pure 2P(32650) 36.5x0.15 mm fuse type</a></li>
      </ul>
      <h2>What it does not do</h2>
      <ul>
        <li>It does not replace the BMS or the main fuse.</li>
        <li>It does not stop an external short; that is the main fuse's job.</li>
        <li>It does not protect against over-charge or over-discharge.</li>
      </ul>
      <h2>Using it well</h2>
      <p>Choose a fuse strip whose narrow section carries the per-cell normal current with margin. Keep welds consistent so the narrow part, not the weld, is the weak point. Read the <a href="/blog/nickel-strip-types-slit-fuse-type-zig-zag-explained.html">strip type guide</a> and the <a href="/blog/lfp-32140-cylindrical-cells-ess-ev-india-buying-guide.html">32140 guide</a>.</p>`,
    faq: [
      ['What size fuse is the narrow section?', 'The rating depends on the design. Ask us for the details if your application is critical.'],
      ['Is fuse type needed in every pack?', 'It is an extra safety layer, most useful in large parallel groups.'],
      ['Does it change the weld process?', 'No, but keep weld spots away from the narrow section.'],
    ],
  }),

  mk({
    slug: 'spot-welding-lfp-32140-32650-cells-nickel-strip-settings-tips',
    category: 'Nickel Strip Plated,Nickel Strip Pure,LFP Cylindrical Cells', tag: 'How-To',
    title: 'Spot-Welding LFP 32140 and 32650 Cells: Settings, Strip Choice and Test Welds',
    short: ['Spot-Welding LFP 32140 and 32650', 'Bigger cells, thicker strip, same careful method'],
    description: 'Tips for spot-welding nickel strip to LFP 32140 and 32650 cylindrical cells: strip thickness, test weld pull tests, electrode pressure and heat control. Strip and cells from Arambhika, Noida.',
    keywords: 'spot welding 32140 cells, 32650 spot weld, LFP cylindrical welding, spot welder settings thick strip, pull test nickel strip',
    productsHeading: 'Strip and cells for LFP welding',
    intro: 'Large cylindrical LFP cells have thick cases and a lot of metal to heat. The method is the same as for 18650s, with a few changes.',
    body: `
      <h2>Choose the strip first</h2>
      <p>Most 32650 and 32140 packs use 0.15 to 0.30 mm strip. Thicker strip carries more current but needs more weld energy. Start with <a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.20 mm CD 34.5 with holder with slit')}">plated 0.20 mm</a> or <a href="${p('Nickel Strip Pure 2P(32650) 46.5x0.15 mm CD 34.5 with holder')}">pure 0.15 mm</a>.</p>
      <h2>Method</h2>
      <ol>
        <li>Clean the strip and cell terminal; no oil or dust.</li>
        <li>Use scrap cells and the same strip for test welds.</li>
        <li>Start at low energy and raise it in small steps until the weld holds.</li>
        <li>Pull-test each setting: the strip should tear, not peel off clean.</li>
        <li>Weld in a pattern that spreads heat, with two spots per terminal at least.</li>
      </ol>
      <h2>Heat control</h2>
      <p>Long weld pulses heat the cell. Avoid welding twice on the same spot and let the cell cool between welds. Wear gloves and keep a fire extinguisher nearby.</p>
      <h2>When your welder is not enough</h2>
      <p>Thick strip and large cells may need a stronger welder than a hobby one. If welds are weak, drop to thinner strip, add more weld spots, or change to bolted busbar designs. More help is in the <a href="/blog/battery-pack-heating-nickel-strip-weak-welds-troubleshooting.html">weak weld troubleshooting guide</a>.</p>
      <h2>Parts</h2>
      <p>Cells: <a href="${p('MOCEAN LFP CELL 3.2V 15AH 32140')}">Mocean 32140</a>. Build example: the <a href="/blog/build-12v-60ah-lfp-pack-32140-cells-4s4p-step-by-step.html">4S4P pack</a>.</p>`,
    faq: [
      ['How many weld spots per terminal?', 'Two or more is normal. Use more for higher-current joints.'],
      ['Why does my strip peel off?', 'Usually too little energy, dirty surfaces or poor electrode contact. Re-run test welds.'],
      ['Can I solder instead?', 'Do not solder directly on cells. Heat from soldering can damage them.'],
    ],
  }),

  mk({
    slug: 'high-current-32650-nickel-strip-0-30mm-plated-and-pure-options',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'High-Current 32650 Nickel Strip at 0.30 mm: Plated and Pure Options Compared',
    short: ['0.30 mm Nickel Strip for 32650', 'When 0.15 mm is not enough'],
    description: 'When to step up to 0.30 mm nickel strip on 32650 and 32140 cells, and how plated and pure versions with and without slits and holders compare. Live prices from Arambhika, Noida.',
    keywords: '0.30mm nickel strip, 47x0.30 nickel strip, high current nickel strip, 32650 thick strip, pure nickel 0.30',
    productsHeading: '0.30 mm 2P strip for 32650',
    intro: 'A pack that moves serious current, like an e-rickshaw or a heavy inverter, may outgrow 0.15 mm strip.',
    body: `
      <h2>The 0.30 mm options</h2>
      <table class="blog-table">
        <thead><tr><th>Strip</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Nickel Strip Plated 2P(32650) 47x0.30 mm CD 32.8 without holder without slit')}">Plated 47x0.30 CD 32.8, no holder, no slit</a></td><td>Tight spacing, plain strip</td></tr>
          <tr><td><a href="${p('Nickel Strip Plated 2P(32650) 46.5x0.30 mm CD 32.8 without holder with slit')}">Plated 46.5x0.30 CD 32.8, no holder, slit</a></td><td>Same spacing, slit version</td></tr>
          <tr><td><a href="${p('Nickel Strip Plated 2P(32650) 47x0.30mm CD 34.5 with holder with slit')}">Plated 47x0.30 CD 34.5, holder, slit</a></td><td>Holder layout, slit</td></tr>
          <tr><td><a href="${p('Nickel Strip Pure 2P(32650) 47x0.30 mm CD 34.5')}">Pure 47x0.30 CD 34.5</a></td><td>Best conductivity</td></tr>
        </tbody>
      </table>
      <h2>Why thicker</h2>
      <p>Doubling thickness doubles cross-section. That cuts resistance and heat at the joint, which matters when many amps flow. Pure nickel adds conductivity on top.</p>
      <h2>But check three things</h2>
      <ol>
        <li>Your welder can weld 0.30 mm reliably; see the <a href="/blog/spot-welding-lfp-32140-32650-cells-nickel-strip-settings-tips.html">LFP welding guide</a>.</li>
        <li>Your layout and holder match the CD (32.8 or 34.5).</li>
        <li>The cells themselves can supply the current.</li>
      </ol>
      <h2>Alternatives</h2>
      <p>For very high current, a bolted <a href="/blog/copper-busbar-battery-ess-india.html">copper busbar</a> design may suit better than strip. Read the <a href="/blog/nickel-strip-thickness-0-15-0-20-0-30-mm-choose-for-current.html">thickness guide</a>.</p>`,
    faq: [
      ['Is 0.30 mm needed for LFP storage?', 'Often not. Storage packs run lower currents; 0.15 to 0.20 mm may be enough.'],
      ['Does thicker strip run cooler?', 'At the same current, yes: larger cross-section means less resistance.'],
      ['Which holder fits CD 34.5?', 'Use a holder with the matching spacing; check the cell holder listing or ask us.'],
    ],
  }),

  mk({
    slug: 'copper-busbar-lengths-55-60-68-82mm-universal-tin-coated-choose',
    category: 'Copper Bus Bar', tag: 'Busbars',
    title: 'Universal Tin-Coated Copper Busbar: Choosing the 55, 60, 68 or 82 mm Length',
    short: ['Copper Busbar: 55, 60, 68 or 82 mm', 'Match the bar to your cell spacing'],
    description: 'Choose among four universal tin-coated copper busbars (55, 60, 68 and 82 mm long, 20 mm wide, 2 mm thick) by cell spacing, cross-section and bolt hole positions. Live prices from Arambhika, Noida.',
    keywords: 'copper busbar 60x20x2, tin coated copper busbar India, 82mm busbar, 68mm busbar, universal copper busbar',
    productsHeading: 'Universal tin-coated copper busbars',
    intro: 'The four universal bars share the same 20 mm width and 2 mm thickness. Only the length changes, so choosing is about spacing.',
    body: `
      <h2>The four lengths</h2>
      <table class="blog-table">
        <thead><tr><th>Bar</th><th>Cross-section</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('COPPER BUS BAR Universal (55x20x2mm) - Tin Coated')}">55 x 20 x 2 mm</a></td><td>40 mm²</td></tr>
          <tr><td><a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">60 x 20 x 2 mm</a></td><td>40 mm²</td></tr>
          <tr><td><a href="${p('COPPER BUS BAR Universal (68x20x2mm)- Tin Coated')}">68 x 20 x 2 mm</a></td><td>40 mm²</td></tr>
          <tr><td><a href="${p('COPPER BUS BAR Universal (82x20x2mm)- Tin Coated')}">82 x 20 x 2 mm</a></td><td>40 mm²</td></tr>
        </tbody>
      </table>
      <p>All share a 40 mm² cross-section (20 x 2), so current capacity is similar; only reach differs.</p>
      <h2>Pick by terminal spacing</h2>
      <ol>
        <li>Measure from the centre of one terminal to the centre of the next.</li>
        <li>Choose a bar that is longer than that distance by the hole margins at each end.</li>
        <li>Drill or confirm the hole positions to fit the cell terminal bolt size.</li>
      </ol>
      <h2>Using more than one bar in parallel</h2>
      <p>For more current, use two bars side by side across the same terminals, or step up to a bar of larger section. Always size for your continuous and peak current and check temperature on a test run.</p>
      <h2>See also</h2>
      <p><a href="/blog/copper-busbar-battery-ess-india.html">Tin-coated copper busbar guide</a> and <a href="/blog/copper-vs-aluminium-busbar-battery-pack-which-to-choose.html">copper vs aluminium</a>.</p>`,
    faq: [
      ['Are the bars pre-drilled?', 'Check the product page and photos for hole details. Ask us if your cell needs a particular hole pattern.'],
      ['Why is copper tin-plated?', 'Tin helps resist oxidation and gives a stable surface for bolted joints.'],
      ['Can I bend the bar?', 'Copper can be bent gently, but bending can crack the tin coating. Use a straight bar where possible.'],
    ],
  }),

  mk({
    slug: 'busbar-bolt-torque-joint-resistance-checks-prismatic-cell-packs',
    category: 'Copper Bus Bar,Aluminium Busbar', tag: 'Pack Building',
    title: 'Busbar Bolt Torque and Joint Checks for Prismatic Cell Packs',
    short: ['Busbar Torque and Joint Checks', 'Make every bolted joint low-resistance'],
    description: 'How to tighten busbar bolts on prismatic LFP cells, why torque matters, how to check joints with a milliohm meter or thermal camera, and how often to re-check. Busbars from Arambhika, Noida.',
    keywords: 'busbar torque battery, prismatic cell bolt torque, joint resistance busbar, loose busbar heat, battery terminal torque',
    productsHeading: 'Copper and aluminium busbars',
    intro: 'A bolted joint that is too loose heats up; one that is too tight can crack a terminal. Torque is the middle path.',
    body: `
      <h2>Prepare</h2>
      <ol>
        <li>Clean cell terminal and busbar faces; remove oil and oxide.</li>
        <li>Use the bolts, washers and spring washers the cell maker specifies.</li>
        <li>Fit the busbar flat so the whole face touches the terminal.</li>
      </ol>
      <h2>Torque it</h2>
      <p>Use a calibrated torque wrench to the value in the cell datasheet. Tighten in two steps, half then full, and mark each bolt with a paint pen so you can see if it later moves. Do not guess the number: terminal threads differ between cells.</p>
      <h2>Check the joints</h2>
      <ul>
        <li><strong>Resistance:</strong> a milliohm meter across each joint; compare all joints and chase any that read higher.</li>
        <li><strong>Heat:</strong> run the pack under load and scan with a thermal camera. A hot joint is a loose or dirty joint.</li>
        <li><strong>Re-check:</strong> after the first cycles, then at regular service intervals.</li>
      </ul>
      <h2>Materials</h2>
      <p>On <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">tin-coated copper</a> use clean, dry joints. On <a href="${p('Aluminium Busbar Model 1 C2C Parallel')}">aluminium</a> prepare the surface and follow the cell maker's advice on contact compound. See the <a href="/blog/aluminium-busbar-cell-to-cell-series-parallel-l-shape-guide.html">aluminium guide</a>.</p>`,
    faq: [
      ['What torque should I use?', 'The one the cell manufacturer lists for that model. We cannot give a universal figure.'],
      ['How often should I re-check?', 'After the first few cycles, then as part of regular service, more often in vehicles with vibration.'],
      ['Can I use thread locker?', 'Only if the cell maker allows it. Many prefer spring washers.'],
    ],
  }),

  mk({
    slug: 'aluminium-busbar-c2c-series-parallel-layouts-16s1p-8s2p-examples',
    category: 'Aluminium Busbar,Prismatic Cells', tag: 'Busbars',
    title: 'Aluminium C2C Busbar Layouts: Worked Examples for 16S1P and 8S2P Packs',
    short: ['Aluminium C2C Busbar Layouts', 'Worked 16S1P and 8S2P examples'],
    description: 'See how Model 1 C2C aluminium series, parallel and L-shape busbars join prismatic cells in 16S1P and 8S2P packs, with parts counts and layout tips. Live prices from Arambhika, Noida.',
    keywords: 'busbar layout 16S1P, 8S2P prismatic layout, aluminium busbar parts count, C2C series parallel, prismatic pack layout',
    productsHeading: 'Model 1 C2C aluminium busbars',
    intro: 'Choosing the right number and type of busbar saves a second order. Here are two layouts worked through.',
    body: `
      <h2>Example 1: 16S1P (one long string)</h2>
      <p>16 cells in series need 15 joints between cells, using <a href="${p('Aluminium Busbar Model 1 C2C Series')}">C2C series bars</a>. The pack ends are the first positive and last negative terminals, connected to the BMS and output cables. If the string is folded into rows, an <a href="${p('Aluminium Busbar Model 1 C2C L Shape')}">L-shape bar</a> turns the corner.</p>
      <h2>Example 2: 8S2P (two cells per group)</h2>
      <p>Pairs of cells connect in parallel: positive to positive, negative to negative, using <a href="${p('Aluminium Busbar Model 1 C2C Parallel')}">C2C parallel bars</a>. The 8 groups then link in series. Count: 8 parallel pairs (2 bars per pair, one per polarity) and 7 series joints between groups.</p>
      <h2>Parts counting</h2>
      <table class="blog-table">
        <thead><tr><th>Layout</th><th>Series bars</th><th>Parallel bars</th></tr></thead>
        <tbody>
          <tr><td>16S1P</td><td>15</td><td>0</td></tr>
          <tr><td>8S2P</td><td>7 (or more, depending on how groups are tied)</td><td>2 per group (16 total)</td></tr>
        </tbody>
      </table>
      <p>Order a few spares and confirm bar fit against your terminal spacing.</p>
      <h2>Tips</h2>
      <ul>
        <li>Sketch cell polarity first; one flipped cell breaks the string.</li>
        <li>Torque all bolts evenly; see the <a href="/blog/busbar-bolt-torque-joint-resistance-checks-prismatic-cell-packs.html">joint check guide</a>.</li>
        <li>Plan cell compression; see the <a href="/blog/lfp-prismatic-cell-compression-swelling-fixture-why-it-matters.html">compression guide</a>.</li>
      </ul>`,
    faq: [
      ['How do I count bars for a bigger pack?', 'Series joints = groups - 1. Parallel bars depend on how many cells share a group.'],
      ['Can I use one bar type for everything?', 'Not usually. Series, parallel and L-shape bars are shaped for different joints.'],
      ['Do I need an extra bar for the output?', 'Output usually uses cables with lugs at the first and last terminals; confirm what your cell terminals accept.'],
    ],
  }),

  mk({
    slug: 'cell-holders-26650-33140-34145-less-common-cylindrical-sizes',
    category: 'Cell Holder', tag: 'Pack Building',
    title: 'Cell Holders for 26650, 33140 and 34145 Cells: Less Common Cylindrical Sizes',
    short: ['Holders for 26650, 33140, 34145', 'Larger cylindrical cells need their own holders'],
    description: 'Cell holders (1X2) for 26650, 33140 and 34145 cylindrical cells: what these cell sizes are used for, how to stack holders and how to pick matching strip. Live prices from Arambhika, Noida.',
    keywords: 'cell holder 26650, 33140 cell holder, 34145 cell holder, large cylindrical cell holder, LFP cylindrical holder India',
    productsHeading: 'Large cylindrical cell holders',
    intro: 'Beyond 18650 and 21700, bigger cylindrical cells appear in LFP and high-capacity packs. Holders for them are harder to find.',
    body: `
      <h2>The three sizes</h2>
      <ul>
        <li><a href="${p('CELL HOLDER 26650 (1X2)')}">26650 holder</a> for cells 26 mm in diameter, common in LFP packs.</li>
        <li><a href="${p('CELL HOLDER 33140 (1X2)')}">33140 holder</a> for 33 mm cells, 140 mm long.</li>
        <li><a href="${p('CELL HOLDER 34145 (1X2)')}">34145 holder</a> for 34 mm cells, 145 mm long.</li>
      </ul>
      <h2>Why holders matter more with big cells</h2>
      <p>Larger cells are heavier, so a loose cell can strain its weld during vibration. A holder carries the load and keeps the spacing right for strip.</p>
      <h2>Checklist</h2>
      <ol>
        <li>Confirm your cell dimensions against the holder size; maker tolerances vary.</li>
        <li>Stack holders to build rows and interlock them as designed.</li>
        <li>Match strip spacing; see the <a href="/blog/nickel-strip-32650-2p-46-5-47-49-5mm-width-and-thickness-guide.html">32650 strip guide</a>.</li>
      </ol>
      <h2>Related</h2>
      <p>For 18650 to 32650 see the <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">main holder guide</a>. If your cell is not listed, tell us the model and we will check what holder fits.</p>`,
    faq: [
      ['What cells are 33140?', 'Cylindrical cells about 33 mm wide and 140 mm long, used in some LFP packs.'],
      ['Can one holder fit two sizes?', 'Not reliably. Use the holder made for your cell size.'],
      ['Do holders improve cooling?', 'They set a gap between cells, which helps air flow if the pack case allows it.'],
    ],
  }),

  mk({
    slug: 'epoxy-sheet-512x1225-large-sheet-cutting-yield-for-battery-factories',
    category: 'Epoxy Board', tag: 'Pack Building',
    title: 'Epoxy Sheet 512x1225x0.5 mm: Getting the Most from a Large Sheet in a Battery Workshop',
    short: ['Large Epoxy Sheet 512x1225 mm', 'Cutting layout, yield and handling'],
    description: 'How to cut and store the large 512x1225x0.5 mm epoxy sheet for battery pack insulation, how many pieces a sheet yields and how it compares with the 502x338 mm sheets. Live price from Arambhika.',
    keywords: 'epoxy sheet 512x1225, large epoxy sheet India, battery insulation sheet cutting, epoxy sheet 0.5mm, epoxy board by kg',
    productsHeading: 'Epoxy sheets',
    intro: 'If you cut a lot of insulation pieces, the large sheet gives you far more area for the money than the small ones.',
    body: `
      <h2>Area comparison</h2>
      <p>The <a href="${p('EPOXY SHEET (512*1225*0.5MM)')}">512 x 1225 x 0.5 mm sheet</a> covers about 0.63 m². The <a href="${p('EPOXY SHEET (502*338*0.5MM)')}">502 x 338 x 0.5 mm sheet</a> covers about 0.17 m². One large sheet is equal to about 3.7 small ones in area. Both are priced per kg.</p>
      <h2>Plan your cuts</h2>
      <ol>
        <li>List every piece you cut: base plates, covers, separators.</li>
        <li>Lay the shapes on a drawing of the sheet and arrange them to leave little waste.</li>
        <li>Keep grain and thickness consistent across a pack.</li>
        <li>Cut the biggest pieces first, then fit the small ones in the offcuts.</li>
      </ol>
      <h2>Cutting and handling</h2>
      <ul>
        <li>Use a sharp blade or a fine saw; wear a dust mask and eye protection.</li>
        <li>Deburr edges so they do not nick wires.</li>
        <li>Store flat and dry, away from sunlight.</li>
      </ul>
      <h2>When to choose the small sheets</h2>
      <p>For a few thicker pieces, the <a href="${p('EPOXY SHEET (502*338*2MM)')}">2 mm</a> or <a href="${p('EPOXY SHEET (502*338*1MM)')}">1 mm</a> sheets give you the stiffness. Read the <a href="/blog/epoxy-sheet-insulation-battery-pack-thickness-guide.html">thickness guide</a>.</p>`,
    faq: [
      ['Is the large sheet only 0.5 mm?', 'This listing is 0.5 mm. Other thicknesses come in the smaller 502x338 mm size.'],
      ['Can I fold it?', 'It is a rigid board. Cut and fit flat pieces rather than bending.'],
      ['How do I know how much I need?', 'Add up the area of all your pieces and add 15 to 20 percent for waste.'],
    ],
  }),

  mk({
    slug: 'potting-compound-vs-conformal-coating-battery-electronics-protection',
    category: 'Potting Compound,BMS', tag: 'Pack Building',
    title: 'Potting Compound vs Conformal Coating: Protecting BMS and Battery Electronics',
    short: ['Potting vs Conformal Coating', 'Which protects a BMS board better, and when'],
    description: 'Compare potting compound and conformal coating for BMS boards and battery electronics: protection, repairability, heat, weight and cost. Our two-part silicone potting gel from Arambhika, Noida.',
    keywords: 'potting vs conformal coating, BMS board waterproofing, silicone potting gel battery, protect BMS from moisture, battery electronics protection',
    productsHeading: 'Silicone potting compound and BMS',
    intro: 'Moisture, dust and vibration kill BMS boards in the field. Two common defences are potting and conformal coating. They are not the same.',
    body: `
      <h2>Side by side</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Potting compound</th><th>Conformal coating</th></tr></thead>
        <tbody>
          <tr><td>Form</td><td>Fills the enclosure around the board</td><td>Thin film on the board surface</td></tr>
          <tr><td>Moisture and dust</td><td>Excellent</td><td>Good</td></tr>
          <tr><td>Vibration</td><td>Excellent, holds parts in place</td><td>Little help</td></tr>
          <tr><td>Heat</td><td>A thermally conductive gel can move heat away</td><td>Little effect</td></tr>
          <tr><td>Repair</td><td>Difficult</td><td>Easier</td></tr>
          <tr><td>Weight and cost</td><td>Higher</td><td>Lower</td></tr>
        </tbody>
      </table>
      <h2>Our potting option</h2>
      <p>The <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">two-part silicone potting compound</a> stays soft, so it protects without stressing components. See the full <a href="/blog/silicone-potting-compound-battery-pack-bms-protection-india.html">potting guide</a>.</p>
      <h2>Which to choose</h2>
      <ul>
        <li>Outdoor, vehicle and sealed packs: potting.</li>
        <li>Indoor packs that may be serviced: conformal coating.</li>
        <li>Both can be combined, with coating first and potting around it.</li>
      </ul>
      <h2>Do not forget the BMS design</h2>
      <p>Whichever you use, keep connectors and the Bluetooth antenna area clear if you use a <a href="${p('DALY LFP 15S-100AMP SMART BMS')}">smart BMS</a>; potting can affect signal and access.</p>`,
    faq: [
      ['Can I pot a BMS with a Bluetooth module?', 'Potting can reduce range and block access. Test first or keep the module area out of the pour.'],
      ['Will potting make it waterproof?', 'It helps a lot, but the enclosure, cable entries and connectors also matter.'],
      ['Is conformal coating enough for e-rickshaws?', 'Vibration and wet conditions often favour potting; the best choice depends on your design.'],
    ],
  }),

  mk({
    slug: 'battery-pack-heat-management-strip-busbar-spacing-potting-india',
    category: 'Nickel Strip Pure,Copper Bus Bar,Cell Holder,Potting Compound', tag: 'Pack Building',
    title: 'Battery Pack Heat Management in Indian Summers: Strip, Busbar, Spacing and Potting',
    short: ['Pack Heat in Indian Summers', 'Five practical ways to run cooler'],
    description: 'Practical ways to keep lithium packs cooler in hot Indian conditions: bigger strip or busbar cross-section, pure nickel, cell holders for air gaps, joint checks and thermally conductive potting. Parts at Arambhika.',
    keywords: 'battery pack heat management India, battery overheating summer, cooler battery pack design, nickel strip heating, busbar heat',
    productsHeading: 'Parts that help packs run cooler',
    intro: 'A pack that runs hot ages fast. Heat comes from resistance and from the sun, and both can be reduced in the design.',
    body: `
      <h2>1. Lower the resistance in the path</h2>
      <p>Heat in a conductor is current squared times resistance. Use a bigger cross-section, for example <a href="${p('Nickel Strip Pure 1P 10x0.30 mm')}">pure 10x0.30 mm strip</a> or copper busbar, where current is high. See the <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing guide</a>.</p>
      <h2>2. Make every joint good</h2>
      <p>Poor welds and loose bolts are hot spots. Pull-test welds and torque busbar bolts as in our <a href="/blog/busbar-bolt-torque-joint-resistance-checks-prismatic-cell-packs.html">joint guide</a>.</p>
      <h2>3. Leave air gaps</h2>
      <p><a href="${p('CELL HOLDER 21700 (1X2)')}">Cell holders</a> set a gap between cells so heat can leave. Do not pack cells so tightly that air cannot move, unless you design a heat path another way.</p>
      <h2>4. Keep the sun and the electronics away from cells</h2>
      <p>Shade the battery bay, mount the BMS away from cells and use a vent where the design allows. Do not trap a hot BMS against cells.</p>
      <h2>5. Move heat with a conductive gel</h2>
      <p>A thermally conductive <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">potting gel</a> can carry heat from the BMS to the case.</p>
      <h2>Measure, do not guess</h2>
      <p>Fit a temperature sensor or use a thermal camera under real load. Check your BMS supports temperature cut-off; many <a href="/blog/smart-bms-vs-hardware-bms-daly-which-to-buy-india.html">smart boards</a> do. Related: the <a href="/blog/battery-pack-heating-nickel-strip-weak-welds-troubleshooting.html">pack heating troubleshooting guide</a>.</p>`,
    faq: [
      ['What temperature is too hot for a lithium pack?', 'Check the cell datasheet. Charging and discharging both have maximum temperature limits.'],
      ['Does a bigger BMS run cooler?', 'A higher-rated BMS running well below its limit usually runs cooler.'],
      ['Will a fan help?', 'Sometimes. In sealed packs, better design of the heat path matters more than a fan.'],
    ],
  }),
]
