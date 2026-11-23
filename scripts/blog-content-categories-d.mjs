// Category posts, part D: PVC, silicone wire, heat shrink tube and insulation paper (two posts for each category).
import { p, mk } from './blog-products-lib.mjs'

const NEW = { date: '2026-11-23', dateLabel: '23 November 2026', strict: true }

export const posts = [
  // ---- PVC ----
  mk({
    ...NEW,
    slug: 'pvc-heat-shrink-sleeve-rolls-for-battery-packs-choosing-the-width',
    category: 'PVC', tag: 'Insulation',
    title: 'PVC Heat Shrink Sleeve for Battery Packs: Choosing the Roll Width',
    short: ['PVC Sleeve for Battery Packs', 'How to choose 320, 340 or 360 mm'],
    description: 'How to choose the width of PVC heat shrink sleeve for a battery pack, with the lay-flat rule, a worked example, how to apply it with a heat gun, and common mistakes. Live prices from Arambhika, Noida.',
    keywords: 'PVC heat shrink sleeve battery pack, PVC sleeve 320mm roll, lay flat width heat shrink, wrap battery pack PVC, battery shrink wrap India',
    productsHeading: 'PVC sleeve rolls',
    intro: 'PVC sleeve wraps a finished pack in a tight, insulating skin. The one choice that matters is the width.',
    body: `
      <h2>What the size means</h2>
      <p>Our PVC heat shrink sleeve is sold in rolls by size: 320, 340 and 360 mm. Sleeve for pack wrapping is normally sized by its lay-flat width, which is the width of the sleeve pressed flat. The sleeve is a tube, so the distance around it is twice the lay-flat width. If you are not sure how a size is measured, ask us before you order a roll.</p>
      <h2>Choose by the pack's cross-section</h2>
      <p>Measure the width (a) and height (b) of the pack at its widest cross-section, with strip and tape included. The distance around the pack is 2 x (a + b), so the sleeve needs a lay-flat width of at least (a + b), and a little more so that it slides over easily.</p>
      <ul>
        <li>As a common rule, pick a lay-flat width about 5 to 10 percent larger than (a + b).</li>
        <li>Sleeve far larger than the pack will not shrink tight and will wrinkle. Sleeve too small will not go on.</li>
      </ul>
      <h2>A worked example</h2>
      <p>A pack measures 150 x 140 mm in cross-section. a + b = 290 mm. Adding 5 to 10 percent gives 305 to 320 mm, so the 320 mm sleeve is the right choice. For a pack of 160 x 170 mm (a + b = 330), the 340 or 360 mm sleeve fits.</p>
      <h2>Applying it</h2>
      <ol>
        <li>Cut the sleeve a little longer than the pack, so it can fold over the ends.</li>
        <li>Slide it over the pack, with the wires and terminals out of the way.</li>
        <li>Shrink it with a heat gun on a low or medium setting, keeping the gun moving. Work from the middle outward.</li>
        <li>Keep the heat away from cell terminals, plastic parts and wires, and do not let one spot get very hot.</li>
        <li>Check that the sleeve is snug and that no sharp edge pokes through it.</li>
      </ol>
      <p>Rolls: <a href="${p('PVC Sleeve 320mm Roll')}">320 mm</a>, <a href="${p('PVC Sleeve 340mm Roll')}">340 mm</a> and <a href="${p('PVC Sleeve 360mm Roll')}">360 mm</a>, sold per kg. Cover sharp strip ends with tape first, as in our <a href="/blog/battery-pack-tapes-which-tape-for-which-job.html">tape guide</a>.</p>`,
    faq: [
      ['What is lay-flat width?', 'The width of the sleeve when it is pressed flat. The distance around the tube is twice that.'],
      ['Can I shrink it with a hairdryer?', 'A hairdryer is usually too weak. A heat gun on a low or medium setting does it properly, with care.'],
      ['Does the sleeve replace insulation paper?', 'No. It is an outer wrap. Use insulation paper and tape inside the pack where parts need a barrier.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'pvc-spiral-wrap-for-bms-harnesses-sizes-and-fitting',
    category: 'PVC', tag: 'Insulation',
    title: 'PVC Spiral Wrap for BMS Harnesses: Sizes and Fitting',
    short: ['PVC Spiral Wrap for BMS Wiring', 'Choose 3, 6, 9 or 12 mm and fit it'],
    description: 'How to choose between 3, 6, 9 and 12 mm PVC spiral wrap for BMS balance leads and battery harnesses, how to fit it without disconnecting wires, and where not to use it. Live prices from Arambhika, Noida.',
    keywords: 'PVC spiral wrap, BMS wire harness spiral, spiral cable wrap sizes, balance lead bundle wrap, cable management battery pack',
    productsHeading: 'PVC spiral wrap',
    intro: 'A BMS comes with a handful of thin balance leads. Spiral wrap turns them into one tidy cable, and it can be added after the wires are connected.',
    body: `
      <h2>Why use spiral wrap</h2>
      <ul>
        <li>It bundles loose wires so they cannot snag or hang across live parts.</li>
        <li>It protects the leads from abrasion against edges and each other.</li>
        <li>It wraps on from the side, so you do not need to disconnect anything, and you can unwrap it to add a wire.</li>
      </ul>
      <h2>Choosing the size</h2>
      <table class="blog-table">
        <thead><tr><th>Size</th><th>Good for</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('PVC SPIRAL 3MM')}">3 mm</a></td><td>One or two thin wires, such as a temperature sensor lead</td></tr>
          <tr><td><a href="${p('PVC SPIRAL 6MM')}">6 mm</a></td><td>A small bundle of balance leads, or a short harness</td></tr>
          <tr><td><a href="${p('PVC SPIRAL 9MM')}">9 mm</a></td><td>A BMS lead bundle for a larger series count</td></tr>
          <tr><td><a href="${p('PVC SPIRAL 12MM')}">12 mm</a></td><td>A thicker bundle, or a harness with a few power wires</td></tr>
        </tbody>
      </table>
      <p>To choose, measure the diameter of the bundle you want to cover, then choose the smallest size that winds on without forcing. A wrap that is too big leaves the bundle loose. One that is too small will not close around it.</p>
      <h2>Fitting it</h2>
      <ol>
        <li>Finish and test the wiring first, and tidy the bundle.</li>
        <li>Start the spiral at one end and wind it along the bundle, turning it as you go.</li>
        <li>Leave the ends of the wires free, and check that each wire can still be reached.</li>
        <li>Secure the ends with a cable tie or a turn of tape so the spiral cannot unwind.</li>
      </ol>
      <h2>Where not to use it</h2>
      <ul>
        <li>For insulating a bare joint. Use heat shrink tube or tape.</li>
        <li>In a spot that gets very hot. Keep it away from the welds and strips.</li>
        <li>As the only protection for a high-current cable. That needs proper insulation of its own.</li>
      </ul>
      <p>Sold per metre. Use it with a <a href="/blog/pg7-cable-glands-metal-vs-plastic-for-bms-and-charger-enclosures.html">cable gland</a> where the harness leaves the box, and see <a href="/blog/bms-wiring-guide-balance-leads-main-cables-order-of-connection.html">how to wire a BMS</a>.</p>`,
    faq: [
      ['Can I add a wire later?', 'Yes. Unwind the spiral, add the wire and wind it back on.'],
      ['Does spiral wrap insulate a joint?', 'No. It tidies and protects the bundle. Use heat shrink or tape for a bare joint.'],
      ['How do I stop it unwinding?', 'Secure each end with a cable tie or a turn of tape.'],
    ],
  }),

  // ---- Silicone Wire ----
  mk({
    ...NEW,
    slug: 'silicone-wire-gauge-guide-awg-mm2-resistance-and-voltage-drop',
    category: 'Silicone Wire', tag: 'Wire',
    title: 'Silicone Wire Gauge Guide: AWG, mm2, Resistance and Voltage Drop',
    short: ['Silicone Wire Gauge Guide', 'AWG to mm2, resistance and voltage drop'],
    description: 'Choose silicone wire for a battery pack with an AWG, mm2 and resistance table for 4, 7, 10 and 16 AWG, and a worked voltage drop example at 20 A over a 2 m round trip. Live prices from Arambhika, Noida.',
    keywords: 'silicone wire gauge, 10 AWG mm2, AWG to mm2 battery wire, voltage drop battery cable, silicone wire resistance per metre, 4 AWG silicone wire',
    productsHeading: 'Silicone wire',
    intro: 'Silicone wire is flexible and stands up to heat, which makes it the favourite for battery leads. The gauge decides how much power you waste in it.',
    body: `
      <h2>The four sizes</h2>
      <p>Copper has a resistivity of about 1.72 x 10<sup>-8</sup> ohm metre, so resistance per metre is that figure divided by the cross-section.</p>
      <table class="blog-table">
        <thead><tr><th>Gauge</th><th>Cross-section</th><th>Resistance per metre, about</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Silicone Wire 4AWG Black')}">4 AWG</a></td><td>21.2 mm<sup>2</sup></td><td>0.81 milliohm</td></tr>
          <tr><td><a href="${p('Silicone Wire 7AWG Black')}">7 AWG</a></td><td>10.6 mm<sup>2</sup></td><td>1.63 milliohm</td></tr>
          <tr><td><a href="${p('Silicone Wire 10AWG Black')}">10 AWG</a></td><td>5.26 mm<sup>2</sup></td><td>3.27 milliohm</td></tr>
          <tr><td><a href="${p('Silicone Wire 16AWG Black')}">16 AWG</a></td><td>1.31 mm<sup>2</sup></td><td>13.1 milliohm</td></tr>
        </tbody>
      </table>
      <h2>Worked example: 20 A over a 2 m round trip</h2>
      <p>For a lead that is 1 m each way, the total length is 2 m. Voltage drop is current times resistance, and the heat in the wire is current squared times resistance.</p>
      <table class="blog-table">
        <thead><tr><th>Gauge</th><th>Resistance (2 m)</th><th>Voltage drop at 20 A</th><th>Heat in the wire</th></tr></thead>
        <tbody>
          <tr><td>4 AWG</td><td>1.6 milliohm</td><td>0.03 V</td><td>0.7 W</td></tr>
          <tr><td>7 AWG</td><td>3.3 milliohm</td><td>0.07 V</td><td>1.3 W</td></tr>
          <tr><td>10 AWG</td><td>6.5 milliohm</td><td>0.13 V</td><td>2.6 W</td></tr>
          <tr><td>16 AWG</td><td>26 milliohm</td><td>0.52 V</td><td>10.5 W</td></tr>
        </tbody>
      </table>
      <p>On a 12.8 V pack, 0.52 V is about 4 percent of the voltage, and 10 W of heat in a thin wire is a lot. The same load on 10 AWG loses about 1 percent. This is why thin wire is for balance leads and sensors, and thick wire is for the main current path.</p>
      <h2>Choosing for your pack</h2>
      <ol>
        <li>Find the continuous current and the length of the run (out and back).</li>
        <li>Pick a gauge that keeps the voltage drop to a small share of the pack voltage, and the heat low.</li>
        <li>Check the wire datasheet for the current it is rated for at your temperature and bundling, since heat is the other limit.</li>
        <li>Make sure the fuse protects the wire, so it is rated lower than the wire's safe current.</li>
      </ol>
      <p>Our wire is multi-strand copper with silicone insulation, in red and black, sold per metre: for example <a href="${p('Silicone Wire 10AWG Red')}">10 AWG red</a> and <a href="${p('Silicone Wire 4AWG Red')}">4 AWG red</a>. Use it with <a href="/blog/sb50-connector-sets-with-thimbles-how-to-choose-and-crimp.html">SB50 connectors</a>.</p>`,
    faq: [
      ['What is AWG?', 'American Wire Gauge. A smaller number means a thicker wire. 4 AWG is much thicker than 16 AWG.'],
      ['Why does thin wire get hot?', 'A thin wire has more resistance, so more of the current turns into heat.'],
      ['Which gauge for a 12 V, 40 A load?', 'Work out the voltage drop and the heat for your run length first. For a short run, 7 AWG or thicker is a common starting point, then check the wire datasheet.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'battery-pack-wiring-colour-code-crimping-and-strain-relief',
    category: 'Silicone Wire', tag: 'Wire',
    title: 'Battery Pack Wiring Done Right: Colour Code, Crimping and Strain Relief',
    short: ['Wiring a Battery Pack Safely', 'Colour code, crimps, fuses and strain relief'],
    description: 'Good wiring habits for a battery pack: red and black colour code, short runs, proper crimps, a fuse near the battery, strain relief and keeping wires away from heat and edges. Live prices from Arambhika, Noida.',
    keywords: 'battery pack wiring, red black wire colour code battery, crimp battery lug, strain relief battery cable, fuse battery positive',
    productsHeading: 'Silicone wire',
    intro: 'A pack is only as safe as its wiring. Most wiring faults come from a few habits that are easy to get right.',
    body: `
      <h2>Colour code</h2>
      <ul>
        <li>Use red for positive and black for negative, everywhere, on every pack. We sell silicone wire in both colours.</li>
        <li>Never use a red wire for a negative lead, even if it is what you have to hand.</li>
        <li>Check polarity with a multimeter before you connect a charger or a load.</li>
      </ul>
      <h2>Keep it short and sized</h2>
      <p>Short, thick leads waste less power. Choose the gauge from the current and the run length, as worked out in our <a href="/blog/silicone-wire-gauge-guide-awg-mm2-resistance-and-voltage-drop.html">wire gauge guide</a>.</p>
      <h2>Crimping</h2>
      <ol>
        <li>Strip the exact length for the lug or contact.</li>
        <li>Use a crimp tool made for the lug. Pliers give a weak, high-resistance joint.</li>
        <li>Check that every strand is inside the barrel, and tug firmly on the wire.</li>
        <li>Cover the joint with heat shrink so no bare metal shows. See <a href="/blog/heat-shrink-on-battery-pack-joints-do-and-dont.html">our heat shrink guide</a>.</li>
      </ol>
      <h2>Fuse the positive</h2>
      <p>Fit a fuse in the positive lead as close to the battery as you can. It protects the wire from a short in the run. Pick a fuse above your normal current and below the safe current of the wire and connectors.</p>
      <h2>Strain relief and routing</h2>
      <ul>
        <li>Fix the wire so that a pull is taken by a clamp or a gland, not by a terminal or a weld.</li>
        <li>Route wires away from sharp edges, strip ends and heat. Use grommets where wires pass through metal.</li>
        <li>Bundle thin leads with <a href="/blog/pvc-spiral-wrap-for-bms-harnesses-sizes-and-fitting.html">spiral wrap</a> and leave a little slack for vibration.</li>
      </ul>
      <h2>A final check</h2>
      <p>With the pack disconnected from its load, check each joint by eye, pull each lug, and confirm continuity with a meter. Then connect and run at a low current before full power.</p>
      <p>Wire used for the main path: <a href="${p('Silicone Wire 7AWG Red')}">7 AWG red</a> and <a href="${p('Silicone Wire 7AWG Black')}">black</a>; for sensor leads: <a href="${p('Silicone Wire 16AWG Red')}">16 AWG</a>.</p>`,
    faq: [
      ['Where does the fuse go?', 'In the positive lead, as close to the battery as possible.'],
      ['Can I twist wires instead of crimping?', 'A twisted joint can heat and loosen. Use a crimped lug or a soldered, insulated joint.'],
      ['Why does strain relief matter?', 'A pull on the wire can tear a weld or loosen a terminal. A clamp or gland takes the load instead.'],
    ],
  }),

  // ---- HST ----
  mk({
    ...NEW,
    slug: 'heat-shrink-tube-sizing-pre-shrink-diameter-and-shrink-ratio',
    category: 'HST', tag: 'Insulation',
    title: 'Heat Shrink Tube Sizing: Pre-Shrink Diameter and Shrink Ratio',
    short: ['Heat Shrink Tube Sizing', 'Pre-shrink size, ratio and a quick check'],
    description: 'How to choose heat shrink tube for wires, lugs and joints: what the pre-shrink diameter means, how the shrink ratio gives the recovered size, and a worked example for 5 to 16 mm tube. Live prices from Arambhika, Noida.',
    keywords: 'heat shrink tube sizing, pre shrink diameter, shrink ratio 2:1, heat shrink 10mm black, how to choose heat shrink tube India',
    productsHeading: 'Heat shrink tube',
    intro: 'A heat shrink tube has to do two things: slide over the part before heating, and grip it after. Two numbers decide both.',
    body: `
      <h2>The two numbers</h2>
      <ul>
        <li><strong>Pre-shrink diameter</strong> is the size of the tube as supplied, which is the size in the listing. The tube must slide easily over the largest part it has to cover.</li>
        <li><strong>Recovered diameter</strong> is the size after full shrinking. It must be smaller than the smallest part, so the tube grips it.</li>
      </ul>
      <p>The shrink ratio links the two. Most heat shrink tube is 2:1, so it shrinks to about half its supplied diameter. Check the ratio of your tube, since some are 3:1 and others are lower.</p>
      <h2>A worked example</h2>
      <p>A 10 mm tube at 2:1 recovers to about 5 mm. It slides over a part up to a little under 10 mm and grips parts down to about 5 mm or slightly more. So it suits a joint that is about 6 to 9 mm across. A part of exactly 10 mm will not slide on, and a 4 mm wire would leave the tube loose.</p>
      <h2>Quick guide to our sizes</h2>
      <table class="blog-table">
        <thead><tr><th>Tube</th><th>Recovers to, at 2:1</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Heat Shrink Tube 5mm Black')}">5 mm</a></td><td>about 2.5 mm</td><td>Thin leads and sensor joints</td></tr>
          <tr><td><a href="${p('Heat Shrink Tube 7mm Black')}">7 mm</a></td><td>about 3.5 mm</td><td>Small wire splices</td></tr>
          <tr><td><a href="${p('Heat Shrink Tube 10mm Black')}">10 mm</a></td><td>about 5 mm</td><td>Medium wires, small lugs</td></tr>
          <tr><td><a href="${p('Heat Shrink Tube 16mm Black')}">16 mm</a></td><td>about 8 mm</td><td>Thicker wires and lug barrels</td></tr>
        </tbody>
      </table>
      <p>We also have <a href="${p('Heat Shrink Tube 6mm Black')}">6 mm</a>, <a href="${p('Heat Shrink Tube 8mm Black')}">8 mm</a> and <a href="${p('Heat Shrink Tube 15mm Black')}">15 mm</a>. They are sold per metre.</p>
      <h2>Check before you buy</h2>
      <ol>
        <li>Measure the biggest part the tube must pass over, such as a crimped lug barrel, with a vernier caliper.</li>
        <li>Measure the smallest part it must grip, such as the bare wire insulation.</li>
        <li>Pick a tube whose supplied size is a little larger than the first and whose recovered size is smaller than the second.</li>
        <li>Test on a scrap piece first.</li>
      </ol>
      <p>For how to use it on a pack, see our <a href="/blog/heat-shrink-on-battery-pack-joints-do-and-dont.html">heat shrink do and don't guide</a>.</p>`,
    faq: [
      ['What is a 2:1 shrink ratio?', 'The tube shrinks to about half its supplied diameter.'],
      ['Can I use one tube size for all wires?', 'No. Match the tube to the part it covers. Too small will not fit, too large will stay loose.'],
      ['Does heat shrink replace tape?', 'It insulates a joint neatly. Tape and heat shrink do different jobs, and both are useful.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'heat-shrink-on-battery-pack-joints-do-and-dont',
    category: 'HST', tag: 'Insulation',
    title: 'Heat Shrink on Battery Pack Joints: What to Do and What to Avoid',
    short: ['Using Heat Shrink on a Pack', 'Do and don\'t for joints, lugs and leads'],
    description: 'How to use black heat shrink tube on battery pack wiring: insulating lugs and splices, controlling heat near cells, and mistakes that leave a joint unprotected. Live prices from Arambhika, Noida.',
    keywords: 'heat shrink battery pack wiring, heat shrink lug insulation, heat gun near battery cells, shrink tube splice, insulate battery joint',
    productsHeading: 'Heat shrink tube',
    intro: 'Heat shrink gives a joint a neat, insulated skin. On a battery pack the heat that makes it work is also the thing to be careful with.',
    body: `
      <h2>Good uses on a pack</h2>
      <ul>
        <li>Covering crimped lugs, so no bare metal is exposed.</li>
        <li>Insulating splices in balance leads and sensor wires.</li>
        <li>Adding strain relief where a wire meets a connector or a lug.</li>
        <li>Marking or grouping wires neatly.</li>
      </ul>
      <h2>Do</h2>
      <ol>
        <li>Slide the tube onto the wire <strong>before</strong> you make the joint. It is easy to forget.</li>
        <li>Choose the right size, as set out in our <a href="/blog/heat-shrink-tube-sizing-pre-shrink-diameter-and-shrink-ratio.html">sizing guide</a>.</li>
        <li>Heat evenly with a heat gun on a low or medium setting, keeping the gun moving.</li>
        <li>Shield nearby cells, plastic and wires with a piece of card or a heat-proof mat.</li>
        <li>Let the joint cool before you move it. Check that the tube has shrunk fully and shows no gaps.</li>
      </ol>
      <h2>Don't</h2>
      <ul>
        <li><strong>Do not heat the tube while it sits next to cells.</strong> Cells should not get hot, so work on the wire away from the pack.</li>
        <li><strong>Do not use a naked flame.</strong> It scorches the tube and can burn the insulation. A lighter near a pack is a hazard.</li>
        <li><strong>Do not shrink over a sharp edge.</strong> The tube can split. File or cover burrs first.</li>
        <li><strong>Do not rely on it for high-voltage insulation.</strong> It is a thin skin and is not a replacement for proper clearance.</li>
        <li><strong>Do not skip the tug test.</strong> Insulation hides a bad crimp, so test the joint before you cover it.</li>
      </ul>
      <h2>Finish</h2>
      <p>When the pack is done, test at low current and feel the joints and lugs for heat. A warm joint after a short run means a high-resistance connection to fix. See <a href="/blog/battery-pack-wiring-colour-code-crimping-and-strain-relief.html">wiring done right</a>.</p>
      <p>Tubes in our range: <a href="${p('Heat Shrink Tube 8mm Black')}">8 mm</a> and <a href="${p('Heat Shrink Tube 10mm Black')}">10 mm</a> black.</p>`,
    faq: [
      ['Can I use a lighter to shrink the tube?', 'No. A flame scorches the tube and is a hazard near a battery. Use a heat gun.'],
      ['Why slide the tube on first?', 'Once a joint is made, you cannot slide the tube over the ends. Put it on before crimping or soldering.'],
      ['How do I know it has shrunk fully?', 'It sits snug with no wrinkles or gaps, and the shape of the joint shows through.'],
    ],
  }),

  // ---- Insulation Paper ----
  mk({
    ...NEW,
    slug: 'battery-insulation-paper-rings-why-they-matter-and-how-to-fit-them',
    category: 'Insulation Paper', tag: 'Insulation',
    title: 'Battery Insulation Paper Rings: Why They Matter and How to Fit Them',
    short: ['Battery Insulation Paper Rings', 'Why they matter and how to fit them'],
    description: 'What terminal insulation paper does in a cylindrical battery pack, which sizes exist for 18650, 21700, 26650, 32700 and 33140 cells, and how to fit it before welding. Live prices from Arambhika, Noida.',
    keywords: 'battery insulation paper, 18650 insulation ring, terminal insulation paper, 21700 insulation paper, 33140 insulation paper India',
    productsHeading: 'Insulation paper by cell size',
    intro: 'A cylindrical cell has bare metal at the edge of its terminal. A paper ring is the cheapest protection against a short there.',
    body: `
      <h2>What the ring does</h2>
      <p>Insulation paper is a die-cut ring, sized for one cell format. It is fitted to the cell as a barrier between the terminal region and nearby conductive pack hardware, such as the strip on the next group, a case or a bracket. Without it, a small shift or a burr can short a cell to something it should not touch.</p>
      <h2>Sizes</h2>
      <p>The ring is made for a particular cell size, so choose by your cell format:</p>
      <ul>
        <li><a href="${p('Insulation Paper 18650')}">18650</a>, supplied in production packs (the listing is a 10,000-piece pack)</li>
        <li><a href="${p('Insulation Paper 21700')}">21700</a></li>
        <li><a href="${p('Insulation Paper 26650')}">26650</a></li>
        <li><a href="${p('Insulation Paper 32700')}">32700</a></li>
        <li><a href="${p('Insulation Paper 33140')}">33140</a></li>
      </ul>
      <p>Check the pack size on each product page, because the number of rings in a pack differs by listing.</p>
      <h2>Fitting it</h2>
      <ol>
        <li>Fit the rings before you lay the strip, with the cells already in their holders, as in our <a href="/blog/assembling-a-cylindrical-battery-pack-holders-insulation-strip-order.html">assembly order</a>.</li>
        <li>Seat each ring flat and centred on the cell end, so the contact area for the weld stays clear.</li>
        <li>Make sure the ring does not cover the weld spots. A ring in the way will weaken the weld.</li>
        <li>Fix it with the cell holder and the strip, or with a dot of suitable adhesive, so it does not slide.</li>
      </ol>
      <h2>Handling and storage</h2>
      <ul>
        <li>Keep the paper dry. Moisture reduces its insulation.</li>
        <li>Store the pack sealed, and take out only what you need.</li>
        <li>Do not reuse a ring that is creased, torn or oily.</li>
      </ul>
      <h2>A note on quantity</h2>
      <p>You need one ring per cell, plus a few percent for waste. Count the cells with our <a href="/blog/how-many-18650-21700-cells-for-your-pack-cell-count-calculator.html">cell count calculator</a>.</p>`,
    faq: [
      ['How many rings do I need?', 'One for each cell, plus a few percent extra for mistakes.'],
      ['Does the ring go on the positive or negative end?', 'Follow your pack design and the product listing. Our 18650 listing is for the negative terminal end, and the product page for each size says how it is used.'],
      ['Will the ring stop a weld working?', 'Only if it covers the weld spot. Keep the weld area clear.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'insulation-paper-rolls-65-and-100-mm-liners-separators-and-barriers',
    category: 'Insulation Paper', tag: 'Insulation',
    title: 'Insulation Paper Rolls (65 and 100 mm): Liners, Separators and Barriers',
    short: ['Insulation Paper Rolls', 'Liners, separators and barriers from a roll'],
    description: 'How to use 65 mm and 100 mm battery insulation paper rolls: cut liners for cases, separators between layers and barriers over strips, plus tips for cutting and keeping it dry. Live prices from Arambhika, Noida.',
    keywords: 'battery insulation paper roll, 65mm insulation paper, 100mm insulation paper roll, pack liner insulation, electrical insulation paper battery',
    productsHeading: 'Insulation paper rolls',
    intro: 'Rings cover the terminals. A roll lets you cut the other insulation a pack needs, to the exact size.',
    body: `
      <h2>Jobs for a roll</h2>
      <ul>
        <li><strong>Case liners.</strong> Line a metal or conductive case so cells and strips cannot touch it.</li>
        <li><strong>Separators.</strong> Put a layer between rows of cells or between a cell group and the BMS.</li>
        <li><strong>Barriers over strip.</strong> Cover long runs of strip, sharp corners and bolted joints.</li>
        <li><strong>Wrapping.</strong> A band of paper around a group of cells before the outer wrap.</li>
      </ul>
      <h2>65 mm or 100 mm</h2>
      <p>The width of the roll is the main choice.</p>
      <ul>
        <li><a href="${p('Insulation Paper Roll 65mm')}">65 mm</a> suits narrow liners and compact barriers, such as a strip run or a small pack side.</li>
        <li><a href="${p('Insulation Paper Roll 100mm')}">100 mm</a> suits wider liners and barriers, and gives more flexibility when you cut shapes from it.</li>
      </ul>
      <p>Choose the width that is at least as wide as the barrier you need, so you can cut it from the roll without a joint. Where a part is wider than the roll, overlap two pieces by a few millimetres instead of leaving a gap.</p>
      <h2>Cutting tips</h2>
      <ol>
        <li>Mark and cut with sharp scissors or a knife against a straight edge.</li>
        <li>Cut a template from card first for a shape you will repeat.</li>
        <li>Make cut-outs for bolts, weld areas and wires before fitting the piece.</li>
        <li>Keep edges clean and free of fluff, which can hold moisture.</li>
      </ol>
      <h2>Fixing it</h2>
      <p>Hold the paper in place with tape on the edges, or with a dot of suitable adhesive, so it does not slide when the pack moves. Do not bridge a joint with tape alone where the paper is the only barrier between conductors.</p>
      <h2>Use the right material for the job</h2>
      <p>Paper insulates, but it is not stiff. For rigid plates and end boards, use <a href="/blog/epoxy-sheet-thickness-guide-0-5-0-8-1-and-2-mm.html">FR-4 epoxy sheet</a>. For wrapping the finished pack, see <a href="/blog/pvc-heat-shrink-sleeve-rolls-for-battery-packs-choosing-the-width.html">PVC sleeve</a>. For terminal rings see <a href="/blog/battery-insulation-paper-rings-why-they-matter-and-how-to-fit-them.html">insulation paper rings</a>.</p>`,
    faq: [
      ['Which roll width should I buy?', 'The narrowest roll that is wide enough for the barrier you need, so you can cut it without a joint. Use 100 mm for wider parts.'],
      ['Can paper replace epoxy sheet?', 'Not for rigid parts. Paper is for liners and barriers; epoxy sheet is for stiff plates.'],
      ['How do I keep it from slipping?', 'Fix the edges with tape or a dot of suitable adhesive.'],
    ],
  }),
]
