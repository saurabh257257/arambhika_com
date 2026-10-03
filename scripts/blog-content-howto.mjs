// How-to and buying-guide posts. Same shape as blog-content.mjs.
// Numbers here are arithmetic or well-known material constants; live prices come from the store grid, never typed here.

const p = (name) => `/?product=${encodeURIComponent(name)}#catalog`
const date = '2026-10-03'
const dateLabel = '3 October 2026'
const PLATED = 'Nickel Strip Plated'
const PURE = 'Nickel Strip Pure'
const COPPER = 'Copper Bus Bar'
const guideNote = '<p class="blog-note">General guidance only. Validate strip size, welding settings and pack safety against your own design and the standards that apply to your product.</p>'

export const posts = [
  {
    slug: 'spot-weld-nickel-strip-18650-21700-battery-pack-guide',
    featured: true,
    category: `${PLATED},${PURE}`,
    tag: 'How-to',
    title: 'How to Spot-Weld Nickel Strip on 18650 and 21700 Cells: A Practical Guide',
    metaTitle: 'How to Spot-Weld Nickel Strip on 18650 & 21700 Cells | Battery Pack Guide India | Arambhika',
    description: 'Step-by-step spot welding guide for nickel strip on 18650 and 21700 cells: settings, weld pattern, pull test, common defects and fixes for Indian workshops, from voltage fluctuation to monsoon humidity.',
    keywords: 'spot welding nickel strip, 18650 spot welding guide, 21700 battery pack welding, battery spot welder settings India, nickel strip welding defects, how to weld battery tabs',
    teaser: 'Settings, weld pattern, pull test and the five defects every pack assembler meets, with fixes.',
    productsHeading: 'Strips to practise and produce with',
    ctaHeading: 'Need sample strips to dial in your welder?',
    waText: 'Hi Arambhika, I read your spot welding guide and want sample nickel strips.',
    heroImage: '/assets/products/nickel-plated/npl_6x.15mm_1.jpg',
    imageAlt: 'Nickel strip ready for spot welding on battery cells',
    date, dateLabel, readTime: 7,
    intro: 'A battery pack is only as good as its welds. A weak weld becomes a hot spot, a hole in the cell can become a safety event. Whether you run a small workshop in Delhi, a pack line in Pune or a start-up lab in Bengaluru, the method below gives clean, repeatable welds on nickel strip.',
    body: `
      <h2>What you need</h2>
      <ul>
        <li><strong>A spot welder with adjustable energy or pulse time.</strong> Fixed-power "DIY" units are hard to tune across different strip thicknesses.</li>
        <li><strong>Copper-alloy electrodes</strong> that are clean, correctly shaped and held at steady pressure.</li>
        <li><strong>Sample strip and a scrap cell</strong> for test welds, in the same thickness you will use in production.</li>
        <li><strong>Eye protection and insulated tools.</strong> Never wear metal jewellery near live cells.</li>
      </ul>

      <h2>Step by step</h2>
      <ol>
        <li><strong>Prepare the strip.</strong> Cut or pick the right size. A dry, clean surface welds best, and oxidised or fingerprinted strip does not. See sizes in our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing calculation guide</a>.</li>
        <li><strong>Start at the lowest energy.</strong> Raise it a little at a time on test welds. Thinner strip such as <a href="${p('Nickel Strip Plated 1P 8x0.15 mm')}">0.15 mm</a> needs far less energy than 0.30 mm.</li>
        <li><strong>Use a double pulse if your machine offers one.</strong> A small first pulse seats the strip and a second pulse forms the weld.</li>
        <li><strong>Press firmly and level.</strong> Both electrode tips should touch the strip evenly.</li>
        <li><strong>Make at least two weld spots per cell terminal.</strong> Space them apart and keep them away from the strip edge.</li>
        <li><strong>Run the pull test.</strong> Peel the strip by hand. A good weld tears the strip and leaves a button of nickel behind. If the strip lifts clean, raise the energy slightly.</li>
        <li><strong>Repeat the test whenever</strong> you change strip batch, thickness, electrodes or machine settings.</li>
      </ol>

      <h2>Five common defects and fixes</h2>
      <table class="blog-table">
        <thead><tr><th>Problem</th><th>Likely cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>Strip peels off easily</td><td>Too little energy, dirty surface or low pressure</td><td>Clean strip, raise energy a step, check electrode pressure</td></tr>
          <tr><td>Hole burned in the strip</td><td>Too much energy for the thickness</td><td>Lower energy or pulse time</td></tr>
          <tr><td>Dent or crater on the cell can</td><td>Excess energy, worn electrodes</td><td>Lower energy, dress or replace tips</td></tr>
          <tr><td>Weld spatter</td><td>Poor contact, oxidised strip</td><td>Wipe strip, reseat the electrodes</td></tr>
          <tr><td>Inconsistent welds through the day</td><td>Supply voltage swings, electrode wear</td><td>Use a stabiliser or UPS, dress tips regularly</td></tr>
        </tbody>
      </table>

      <h2>Tips for Indian workshops</h2>
      <ul>
        <li><strong>Voltage fluctuation:</strong> Mains swings change weld energy from one pack to the next. A good stabiliser or online UPS on the welder pays for itself.</li>
        <li><strong>Humidity:</strong> In monsoon, keep strip sealed with silica gel and open coils only when needed.</li>
        <li><strong>Heat and dust:</strong> Keep the bench clean. Dust on electrodes causes weak welds.</li>
        <li><strong>Pure or plated?</strong> <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">Pure nickel</a> is softer and often welds at lower energy. <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">Plated strip</a> may need slightly more. Test each.</li>
      </ul>

      <h2>Safety first</h2>
      <p>Welding on charged cells can short them if the electrode or a tool bridges the terminals. Insulate the pack, weld one series group at a time, keep the BMS disconnected while welding, and keep a fire-safe area ready. Never weld on a damaged cell.</p>
      ${guideNote}`,
    faq: [
      ['What energy setting should I use for 0.15 mm nickel strip?', 'It depends on your welder, so start at the lowest setting and raise it step by step on a scrap cell. Stop when the pull test tears the strip, not the weld.'],
      ['Why do my welds peel off the cell?', 'The usual causes are too little energy, a dirty or oxidised surface, or low electrode pressure. Clean the strip and raise the energy a little.'],
      ['How many weld spots do I need per cell terminal?', 'Most builders use at least two per terminal. High-current packs often use more or a wider strip. Check with your design and test pull strength.'],
      ['Can I spot-weld 0.30 mm strip with a hobby welder?', 'Many hobby welders struggle with 0.30 mm. Test on scrap first, and consider thinner strip in parallel layers if your machine cannot weld it reliably.'],
      ['Does pure nickel need different settings from plated strip?', 'Often a little lower energy, because pure nickel is softer. Test each strip type and thickness on your machine.'],
    ],
  },

  {
    slug: 'build-48v-lithium-battery-pack-electric-scooter-india',
    featured: true,
    category: PURE,
    tag: 'Pack Building',
    title: 'Building a 48V Lithium Battery Pack for an Electric Scooter in India: Strip and Layout Guide',
    metaTitle: '48V (13S) Lithium Battery Pack for Electric Scooter India: Nickel Strip & Layout Guide | Arambhika',
    description: 'Planning a 48V 13S lithium pack for an e-scooter in India? Learn the pack math, how to choose nickel strip for parallel groups and series links, where copper helps, and the safety checks that matter.',
    keywords: '48V lithium battery pack India, 13S battery pack, electric scooter battery pack, 21700 battery pack nickel strip, e-bike battery building India, series parallel battery pack, BMS for 48V pack',
    teaser: '13S pack maths, 2P strips for parallel groups, and why series links carry the full pack current.',
    productsHeading: 'Strips used in 13S 18650 and 21700 packs',
    ctaHeading: 'Designing a 48V pack and want strip advice?',
    waText: 'Hi Arambhika, I am building a 48V lithium pack and need nickel strip advice.',
    heroImage: '/assets/products/nickel-pure/np_2p_31x.15mm_1.jpg',
    imageAlt: 'Pure nickel 2P strip for 21700 cell battery pack',
    date, dateLabel, readTime: 7,
    intro: 'Electric scooters and e-bikes are the biggest battery pack market in India, and most use 48 V lithium-ion packs. If you are designing or repairing one, the pack maths and the strip layout decide how cool and how long it will run. This guide walks through both.',
    body: `
      <h2>Pack maths: what 13S means</h2>
      <p>A lithium-ion cell is about 3.6 V nominal and 4.2 V fully charged. Thirteen cells in series (<strong>13S</strong>) give about 46.8 V nominal and 54.6 V full, which is the usual "48 V" pack. The number after S is how many cells sit in series; the number with P is how many sit in parallel. A <strong>13S6P</strong> pack of 21700 cells has 78 cells. If each cell is 4.5 Ah, the pack is 27 Ah, or roughly 1.26 kWh (13 x 3.6 V x 27 Ah). Treat this as an illustration, since your cell and range target will differ.</p>

      <h2>Two kinds of connection, two different jobs</h2>
      <ul>
        <li><strong>Parallel groups.</strong> The cells in one P-group share the current. A <a href="${p('Nickel Strip Pure 2P(21700) 31x0.15 mm without holder CD 22.5')}">2P strip</a> joins two cells at a time and speeds up assembly.</li>
        <li><strong>Series links.</strong> These carry the <em>whole pack current</em>. At a 40 A controller limit, every series link carries up to 40 A, so it needs far more cross-section than a cell-to-cell strip.</li>
      </ul>

      <h2>Choosing strip for each job</h2>
      <p>Inside a P-group, the current splits across cells. With 6 cells in parallel at 40 A, each cell carries about 6.7 A, which should sit within the cell's continuous rating. The series links are the weak point. Options:</p>
      <ol>
        <li>Use a <strong>wide, thick strip</strong> such as <a href="${p('Nickel Strip Pure 1P 10 x 0.3 mm')}">10 x 0.30 mm</a>.</li>
        <li>Use <strong>two or more strips in parallel</strong> across each series link.</li>
        <li>Move the main current path to <a href="/blog/copper-busbar-battery-ess-india.html">copper busbar</a> where the layout allows.</li>
      </ol>
      <p>Not sure of the numbers? Use our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing calculation guide</a>. For hot Indian summers and heavy hill climbing, pure nickel gives more thermal headroom than plated; see the <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel guide</a>.</p>

      <h2>Do not skip these</h2>
      <ul>
        <li><strong>A BMS rated above your peak current</strong> with proper balancing and temperature sensing.</li>
        <li><strong>A fuse or breaker</strong> in the main path.</li>
        <li><strong>Cell holders or spacers</strong> so cells cannot touch or move.</li>
        <li><strong>Matched cells</strong> from one batch and the same grade.</li>
        <li><strong>A thermal test</strong> at full load before sale or use.</li>
      </ul>
      <p>If you manufacture packs for sale, India's norms for electric two-wheelers (such as AIS-156) and your type-approval requirements apply to the complete pack. A good strip choice helps, but it does not replace testing.</p>
      ${guideNote}`,
    faq: [
      ['How many cells do I need for a 48V pack?', 'A 13S Li-ion pack needs 13 cells in series for about 48 V. Multiply by the parallel count for capacity. For example, 13S6P needs 78 cells.'],
      ['What strip joins the cells in a parallel group?', 'Most builders use a 2P pre-cut strip or a plain strip across the group. Pick a width that matches your cell spacing and weld pattern.'],
      ['Why do series links need thicker strip?', 'Series links carry the full pack current, while each parallel cell carries only a share of it.'],
      ['Is 48 V LFP different from 48 V Li-ion?', 'Yes. LFP packs usually use 16 cells in series (about 51.2 V), against 13 for Li-ion. Chargers, BMS and cut-off voltages are different.'],
      ['Can I use plated strip for an e-scooter?', 'For low-current builds, often yes. For heavy-current or hot-climate scooters we recommend pure nickel or parallel strips. Send us your pack current and we will suggest a size.'],
    ],
  },

  {
    slug: 'lfp-battery-pack-solar-inverter-nickel-strip-busbar-india',
    category: `${PURE},${COPPER}`,
    tag: 'Solar & Inverter',
    title: 'LFP Battery Packs for Solar and Home Inverters in India: Strip and Busbar Choices',
    metaTitle: 'LFP Battery Pack for Solar & Home Inverter in India: Nickel Strip & Copper Busbar | Arambhika',
    description: 'Building an LFP (LiFePO4) pack for a home inverter or solar light in India? Compare 32650 cylindrical cells with nickel strip against prismatic cells with copper busbar, with voltage maths and charging tips.',
    keywords: 'LFP battery pack India, LiFePO4 inverter battery, 12V 4S LFP pack, solar street light battery pack, 32650 LFP nickel strip, prismatic LFP copper busbar, lithium inverter battery India',
    teaser: 'Cylindrical or prismatic LFP, how 4S and 16S packs work, and which interconnect fits which build.',
    productsHeading: 'Strips and busbars for LFP packs',
    ctaHeading: 'Building a solar or inverter battery?',
    waText: 'Hi Arambhika, I am building an LFP pack and need strip or busbar advice.',
    heroImage: '/assets/products/copper-bus-bars/universe_2mm_1.jpg',
    imageAlt: 'Tin-coated universal copper busbars for LFP battery packs',
    date, dateLabel, readTime: 6,
    intro: 'Power cuts, rising electricity bills and falling lithium prices are pushing Indian homes and shops from lead-acid to lithium iron phosphate (LFP). LFP is safe, long-lived and tolerant of heat, which suits Indian summers. How you connect the cells depends on whether you use small cylindrical cells or large prismatic ones.',
    body: `
      <h2>Voltage maths for LFP</h2>
      <p>An LFP cell is about 3.2 V nominal and 3.65 V at full charge. Four in series (<strong>4S</strong>) make a nominal 12.8 V pack, a drop-in for a 12 V inverter. Eight in series give 25.6 V, and sixteen give 51.2 V for larger solar systems. Set your charger or inverter to an <strong>LFP charging profile</strong>. Do not assume a lead-acid setting will suit.</p>

      <h2>Two build styles</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Cylindrical cells (32650, 33140)</th><th>Large prismatic cells</th></tr></thead>
        <tbody>
          <tr><td>Best for</td><td>Small packs: solar lights, lanterns, compact inverters</td><td>Larger home, shop and telecom storage</td></tr>
          <tr><td>Connection</td><td>Spot-welded nickel strip</td><td>Bolted copper busbar</td></tr>
          <tr><td>Our parts</td><td><a href="${p('Nickel Strip Pure 2P(32650) with holder 46.5x0.15 mm CD 34.5')}">2P 32650</a>, <a href="${p('Nickel Strip Pure 2P(33140) 46.5x0.3 mm - Zig Zag')}">33140 zig-zag</a></td><td><a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">Tin-coated copper bars</a></td></tr>
        </tbody>
      </table>
      <p>Cylindrical LFP packs use the same welding method as other cylindrical cells; read our <a href="/blog/spot-weld-nickel-strip-18650-21700-battery-pack-guide.html">spot welding guide</a>. Prismatic packs use bolted joints; see the <a href="/blog/copper-busbar-battery-ess-india.html">copper busbar guide</a>.</p>

      <h2>Why pure nickel for LFP strip?</h2>
      <p>LFP cells run at a lower voltage than Li-ion, so for the same power the current is higher. Lower strip resistance reduces heat at the joints. For that reason we suggest <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel</a> for 32650 and 33140 packs.</p>

      <h2>Indian conditions to plan for</h2>
      <ul>
        <li><strong>Heat:</strong> LFP handles heat better than most lithium chemistries, but a closed box in a hot room still needs airflow.</li>
        <li><strong>Cold:</strong> Do not charge LFP below 0 &deg;C unless the cells and BMS are rated for it. This matters in Ladakh, Himachal and Kashmir.</li>
        <li><strong>Dust and humidity:</strong> Seal terminals and use tin-coated copper to resist tarnish.</li>
        <li><strong>Grid quality:</strong> Frequent outages mean frequent deep cycles; size the pack with some reserve.</li>
      </ul>
      ${guideNote}`,
    faq: [
      ['Can I replace my 12V lead-acid inverter battery with a 4S LFP pack?', 'Often yes, if the inverter charger has an LFP profile or a compatible setting and the BMS supports your load. Check your inverter manual and keep the BMS rated above peak current.'],
      ['Which strip fits 32650 LFP cells?', 'A 2P strip made for the 32650 format, with or without holder, depending on your layout. See the listings for width, thickness and centre distance.'],
      ['Do prismatic LFP cells use nickel strip?', 'Usually no. Large prismatic cells use bolted terminals and flat copper busbars.'],
      ['What size busbar for a 100 Ah LFP cell?', 'It depends on your continuous current. A 20 x 2 mm bar suits tens of amps; heavier loads need a larger section or parallel bars.'],
      ['Is LFP safer than regular lithium-ion?', 'LFP is generally more thermally stable, but pack design, BMS and installation still matter.'],
    ],
  },

  {
    slug: 'how-to-calculate-nickel-strip-size-battery-pack-current',
    category: `${PLATED},${PURE}`,
    tag: 'Sizing',
    title: 'How to Calculate Nickel Strip Size for Your Battery Pack Current (With Worked Examples)',
    metaTitle: 'How to Calculate Nickel Strip Size for Battery Pack Current | Worked Examples | Arambhika',
    description: 'Learn to size nickel strip for your battery pack: cross-section, resistance and heat with worked examples for 8x0.15, 10x0.30 and 2P strips. Pure nickel vs plated steel, written for Indian pack builders.',
    keywords: 'nickel strip size calculator, nickel strip current rating, nickel strip resistance, battery pack strip selection, 8x0.15 nickel strip current, how thick nickel strip for battery pack, pure nickel vs plated resistance',
    teaser: 'Cross-section, resistance and heat in three steps, with a table for the sizes in our store.',
    productsHeading: 'Strip sizes to choose from',
    ctaHeading: 'Not sure which size fits your current?',
    waText: 'Hi Arambhika, I read your strip sizing guide. Please suggest a size for my pack.',
    heroImage: '/assets/products/nickel-pure/np_10x.3mm_1.jpg',
    imageAlt: 'Pure nickel strip 10 x 0.3 mm for high-current battery packs',
    date, dateLabel, readTime: 7,
    intro: 'Strip that is too small runs hot. Strip that is too big wastes money and is hard to weld. Instead of guessing, use three simple steps: find the current in the strip, find the cross-section you have, and check the heat. The numbers below are plain arithmetic you can repeat on a calculator.',
    body: `
      <h2>Step 1: find the current in the strip</h2>
      <p>Strips in different places carry different current. A strip between cells in one parallel group carries only that cell's share. A <strong>series link</strong> carries the full pack current. So a 40 A pack with 6 cells in parallel has about 6.7 A per cell, but 40 A in each series link.</p>

      <h2>Step 2: find the cross-section</h2>
      <p>Cross-section (mm&sup2;) is width times thickness. For pre-cut 2P strips the cut-outs reduce the real section, so measure the narrowest part.</p>
      <table class="blog-table">
        <thead><tr><th>Strip</th><th>Cross-section</th><th>Resistance per 10 mm (pure nickel)</th></tr></thead>
        <tbody>
          <tr><td>6 x 0.15 mm</td><td>0.90 mm&sup2;</td><td>0.78 m&Omega;</td></tr>
          <tr><td><a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">8 x 0.15 mm</a></td><td>1.20 mm&sup2;</td><td>0.58 m&Omega;</td></tr>
          <tr><td>10 x 0.15 mm</td><td>1.50 mm&sup2;</td><td>0.47 m&Omega;</td></tr>
          <tr><td>10 x 0.20 mm</td><td>2.00 mm&sup2;</td><td>0.35 m&Omega;</td></tr>
          <tr><td>8 x 0.30 mm</td><td>2.40 mm&sup2;</td><td>0.29 m&Omega;</td></tr>
          <tr><td><a href="${p('Nickel Strip Pure 1P 10 x 0.3 mm')}">10 x 0.30 mm</a></td><td>3.00 mm&sup2;</td><td>0.23 m&Omega;</td></tr>
        </tbody>
      </table>

      <h2>Step 3: check the resistance and heat</h2>
      <p>Resistance is <em>R = &rho; x L / A</em>. For nickel, &rho; is about 0.07 &Omega;&middot;mm&sup2;/m (roughly 7 &micro;&Omega;&middot;cm), so a 10 mm length has a resistance of about 0.7 / A m&Omega;, with A in mm&sup2;. That is how the table above was made. Heat in the strip is <em>I&sup2; x R</em>.</p>
      <p><strong>Worked example.</strong> A 10 mm piece of 8 x 0.15 mm pure nickel is 0.58 m&Omega;. At 20 A it dissipates 20&sup2; x 0.00058 = 0.23 W. The same length of 10 x 0.30 mm is 0.23 m&Omega;, which is 0.093 W at 20 A, less than half the heat. Small numbers, but a pack has many joints, in a closed box, in an Indian summer.</p>
      <p><strong>Plated steel runs hotter.</strong> A steel core has roughly twice the resistivity of nickel, or more, so a plated strip of the same size dissipates correspondingly more heat. This is why <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel</a> is preferred for heavy loads and <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">plated strip</a> for lighter ones.</p>

      <h2>Rules of thumb that save mistakes</h2>
      <ul>
        <li>Size series links for the <strong>peak</strong> pack current, not the average.</li>
        <li>Add strips in parallel (layers or side by side) when one strip is not enough.</li>
        <li>Past a few tens of amps, consider <a href="/blog/copper-busbar-battery-ess-india.html">copper busbar</a>.</li>
        <li>Joint quality matters as much as strip size. A weak weld adds resistance on its own; see <a href="/blog/battery-pack-heating-nickel-strip-weak-welds-troubleshooting.html">pack heating troubleshooting</a>.</li>
        <li>Always confirm with a temperature test at full load.</li>
      </ul>
      <p>See also our <a href="/18650-21700-32650-nickel-strip-sizing-guide.html">18650 vs 21700 vs 32650 sizing guide</a>.</p>
      <p class="blog-note">The figures use standard resistivity values for pure nickel and give a starting point only. Real strips, welds and temperatures vary. Validate with your own tests.</p>`,
    faq: [
      ['How do I find the current rating of nickel strip?', 'There is no single rating, because it depends on allowed temperature rise, strip length and cooling. Calculate resistance and heat for your current as shown here, then confirm with a load test.'],
      ['What is the resistance of 8 x 0.15 mm nickel strip?', 'For pure nickel, about 0.58 mΩ per 10 mm of length, from 0.07 Ω·mm²/m divided by the 1.2 mm² cross-section.'],
      ['Is plated steel strip worse than pure nickel for current?', 'Yes. The steel core has higher resistance, so the same size runs hotter. It remains fine for lighter loads.'],
      ['How can I carry more current without changing the strip size?', 'Add strips in parallel, shorten the path, or move the main path to copper busbar.'],
      ['Do 2P strips carry more current than 1P?', 'A wider 2P strip has more cross-section, but its cut-outs reduce it. Measure the narrowest section when you calculate.'],
    ],
  },

  {
    slug: 'battery-pack-heating-nickel-strip-weak-welds-troubleshooting',
    category: `${PLATED},${PURE}`,
    tag: 'Troubleshooting',
    title: 'Why Is My Lithium Battery Pack Heating Up? Nickel Strip, Weak Welds and Busbar Fixes',
    metaTitle: 'Why Is My Battery Pack Heating Up? Nickel Strip, Weld & Busbar Fixes | Arambhika',
    description: 'Battery pack getting hot? Find the cause: undersized nickel strip, weak spot welds, oxidation, loose busbar bolts or high ambient heat. Simple voltage-drop and temperature tests for Indian pack builders.',
    keywords: 'battery pack heating, lithium battery pack overheating, nickel strip hot, weak spot weld battery, busbar loose heating, battery joint resistance test, e-bike battery getting hot India',
    teaser: 'Five causes of hot packs and a simple voltage-drop test to find the bad joint.',
    productsHeading: 'Replacement and upgrade strips',
    ctaHeading: 'Found an undersized strip? Let us help you pick the right one.',
    waText: 'Hi Arambhika, my pack is heating up and I need help choosing strip or busbar.',
    heroImage: '/assets/products/copper-bus-bars/custom_1.jpg',
    imageAlt: 'Custom copper busbar for battery pack interconnects',
    date, dateLabel, readTime: 6,
    intro: 'A warm pack under load is normal. A pack with one hot spot is a warning. In India, summer heat, dusty roads and daily deep cycling make small interconnect faults show up fast. This guide helps you find the cause and fix it.',
    body: `
      <h2>The five usual suspects</h2>
      <ol>
        <li><strong>Undersized strip.</strong> The cross-section is too small for the current. Check it with our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing calculation</a>.</li>
        <li><strong>Weak or cold welds.</strong> The weld nugget is small, so resistance is high at that spot. See our <a href="/blog/spot-weld-nickel-strip-18650-21700-battery-pack-guide.html">spot welding guide</a>.</li>
        <li><strong>Oxidised or dirty strip.</strong> Humidity and fingerprints create a film that raises resistance.</li>
        <li><strong>Loose or dirty bolted joints.</strong> Common on busbar packs. Heat cycles can loosen bolts.</li>
        <li><strong>Hot surroundings or no airflow.</strong> A pack in a sealed box on a hot day has no margin.</li>
      </ol>

      <h2>A simple voltage-drop test</h2>
      <p>You need a multimeter and a safe way to run the pack under load. Measure the millivolt drop across each joint or strip segment while current flows. Voltage drop is <em>V = I x R</em>. For example, 20 A across a joint of 0.5 m&Omega; gives 10 mV. A joint that reads several times higher than its neighbours is your hot spot. Mark it and inspect it.</p>
      <p>A thermal camera or a thermocouple on the strip also works. Compare temperatures after a steady-load run, and look for one joint that is clearly hotter than the rest.</p>

      <h2>Fixes</h2>
      <table class="blog-table">
        <thead><tr><th>Cause</th><th>Fix</th></tr></thead>
        <tbody>
          <tr><td>Undersized strip</td><td>Move to a thicker or wider strip, add parallel layers, or switch to <a href="${p('Nickel Strip Pure 1P 10 x 0.3 mm')}">pure nickel 10 x 0.30 mm</a></td></tr>
          <tr><td>Weak weld</td><td>Re-weld with tuned settings and add more weld spots</td></tr>
          <tr><td>Oxidised strip</td><td>Replace with fresh dry strip. Store sealed with silica gel</td></tr>
          <tr><td>Loose bolt</td><td>Clean contact faces and retighten to the cell maker's torque. Use <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">tin-coated copper</a> to resist tarnish</td></tr>
          <tr><td>Hot enclosure</td><td>Add airflow, spacing or a heat path to the case</td></tr>
        </tbody>
      </table>

      <h2>When to stop and call for help</h2>
      <p>If any cell swells, smells, or shows a temperature that keeps rising at light load, stop using the pack, move it somewhere safe and have it checked. Do not keep running a pack with a runaway hot spot.</p>
      <p>Building for heavy duty? Read about <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel strip</a> and the <a href="/blog/copper-busbar-battery-ess-india.html">copper busbar</a> option.</p>
      ${guideNote}`,
    faq: [
      ['How hot is too hot for a lithium battery pack?', 'Follow your cell maker’s data sheet. If the case or any strip is too hot to hold, or one spot is much hotter than the rest, investigate before using the pack further.'],
      ['How do I know if a spot weld is weak?', 'Do a pull test on a sample, or measure the voltage drop across the weld under load. A high reading compared with neighbouring welds suggests a weak joint.'],
      ['Can loose busbar bolts cause heating?', 'Yes. A loose joint has higher resistance and heats up. Clean the faces and retighten to the cell maker’s torque.'],
      ['Will pure nickel fix a hot pack?', 'It lowers strip resistance, which helps. But weld quality and joint design also matter, so test after changing.'],
      ['Why do packs heat more in Indian summer?', 'High ambient temperature leaves less margin, and closed enclosures trap heat. Design for the hottest conditions your product will meet.'],
    ],
  },

  {
    slug: 'nickel-strip-price-per-kg-india-plated-vs-pure',
    featured: true,
    category: `${PLATED},${PURE}`,
    tag: 'Pricing',
    title: 'Nickel Strip Price per kg in India: What Decides the Rate (Plated vs Pure)',
    metaTitle: 'Nickel Strip Price per kg in India: Plated vs Pure, What Decides the Rate | Arambhika',
    description: 'Why nickel strip prices differ in India: nickel metal rates, plated vs pure, thickness, 1P vs 2P forms, quantity and GST. Learn to compare quotes and convert price per kg to price per metre. Live prices included.',
    keywords: 'nickel strip price per kg India, nickel strip rate, pure nickel strip price, nickel plated strip price, 18650 nickel strip price, battery nickel strip cost per metre, nickel strip supplier Noida',
    teaser: 'Why quotes differ, how to compare them fairly, and a quick kg-to-metre conversion for 8 x 0.15 mm strip.',
    productsHeading: 'Live prices today',
    ctaHeading: 'Want a firm quote for your quantity?',
    waText: 'Hi Arambhika, I read your nickel strip price guide and need a quote for my quantity.',
    heroImage: '/assets/products/nickel-plated/npl_8x.15mm_1.jpg',
    imageAlt: 'Nickel-plated strip 8 x 0.15 mm',
    date, dateLabel, readTime: 6,
    intro: 'If you have asked three suppliers for nickel strip prices you have probably got three very different answers. Some of the gap is real, some comes from what is being quoted. Here is what drives the rate per kg in India and how to compare quotes fairly.',
    body: `
      <h2>What decides the price per kg</h2>
      <ul>
        <li><strong>Plated or pure.</strong> Plated strip is a steel core with a thin nickel layer, so it costs a fraction of strip that is nickel all through. The live gap is visible in the product list below.</li>
        <li><strong>Nickel metal rates.</strong> Pure nickel follows international nickel prices and the rupee-dollar rate, so quotes can change from week to week.</li>
        <li><strong>Thickness and width.</strong> Thinner or narrower strip takes more processing per kg.</li>
        <li><strong>Form.</strong> Plain 1P strip costs less to make than punched or formed 2P, holder, fuse-type and zig-zag strips.</li>
        <li><strong>Plating spec.</strong> For plated strip, plating thickness and quality change the cost and the corrosion life.</li>
        <li><strong>Quantity.</strong> Larger orders can get better rates; every product page shows the minimum order.</li>
        <li><strong>GST and freight.</strong> Quotes may or may not include them. Ask.</li>
      </ul>

      <h2>Convert price per kg to price per metre</h2>
      <p>Pack builders buy by weight but design by length. Using nickel density of about 8.9 g/cm&sup3;, an 8 x 0.15 mm strip weighs about 10.7 g per metre in pure nickel, so a kilogram is roughly 93 metres. For plated steel, with a density near 7.85 g/cm&sup3;, it is about 9.4 g per metre, or around 106 metres per kg. Divide the price per kg by those lengths to compare cost per metre, and by the strip length per pack for cost per pack.</p>

      <h2>Compare quotes like for like</h2>
      <ol>
        <li>Same thickness and width, with the tolerance stated.</li>
        <li>Same material: plated or pure, and the grade or plating thickness.</li>
        <li>Same form: plain, 2P, holder, slit, fuse or zig-zag.</li>
        <li>Same terms: GST, freight, minimum quantity, delivery time.</li>
        <li>Check surface quality on a sample, by welding it.</li>
      </ol>

      <h2>When the cheaper strip costs more</h2>
      <p>A low rate on strip that oxidises, or one that welds inconsistently, becomes a rejected pack. For high-current or long-life packs, <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel</a> often lowers the total cost; for lighter loads, <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">plated strip</a> is the sensible choice. Not sure which? See the <a href="/nickel-plated-vs-pure-nickel-strip.html">plated vs pure comparison</a>.</p>

      <h2>Buying from Arambhika</h2>
      <p>Every product page shows the price, the unit and the minimum quantity. Build a quote from the <a href="/#catalog">product store</a>, send it on WhatsApp, and we confirm price, GST and dispatch from Noida. You can also download our <a href="/catalog.html?autoprint=1">PDF catalogue</a>.</p>
      <p class="blog-note">Prices on this page's product tiles are live from our store and can change. Final price is confirmed on your quote.</p>`,
    faq: [
      ['Why is pure nickel strip so much costlier than plated?', 'Pure nickel is nickel all the way through, while plated strip is mostly steel with a thin nickel layer. Nickel is much more expensive than steel.'],
      ['Does the price per kg change with thickness?', 'Often yes. Thinner or narrower strip needs more processing per kg, and special forms such as 2P or zig-zag add manufacturing cost.'],
      ['How many metres are in 1 kg of 8 x 0.15 mm strip?', 'Roughly 93 m of pure nickel or about 106 m of plated steel strip, from material density and the strip cross-section.'],
      ['Is GST included in your prices?', 'The tiles show the store price. GST and freight are confirmed on your quote, so ask us when you request it.'],
      ['Do you give bulk discounts?', 'Larger quantities can get better rates. Send your quantity on WhatsApp and we will quote.'],
    ],
  },
]
