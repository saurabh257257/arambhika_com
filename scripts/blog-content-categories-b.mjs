// Category posts, part B: BMS, copper and aluminium busbars, epoxy board (two posts for each category).
import { p, mk } from './blog-products-lib.mjs'

const NEW = { date: '2026-11-23', dateLabel: '23 November 2026', strict: true }

export const posts = [
  // ---- BMS ----
  mk({
    ...NEW,
    slug: 'smart-bms-uart-rs485-and-can-what-each-port-is-for',
    category: 'BMS', tag: 'BMS',
    title: 'UART, RS485 and CAN on a Smart BMS: What Each Port Is For',
    short: ['Smart BMS: UART, RS485, CAN', 'Which communication port you actually need'],
    description: 'What the UART, RS485, CAN and Bluetooth options on a smart BMS do, which one suits an app, a battery bank or a solar inverter, and what to check before you buy. Live prices from Arambhika, Noida.',
    keywords: 'smart BMS RS485 CAN UART, Daly smart BMS Bluetooth, BMS inverter communication, BMS CAN bus solar inverter, BMS app monitoring',
    productsHeading: 'Smart BMS models',
    intro: 'Smart BMS listings are full of acronyms. Each port solves a different problem, and many packs need only one of them.',
    body: `
      <h2>What each one does</h2>
      <table class="blog-table">
        <thead><tr><th>Port</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td>Bluetooth</td><td>Check voltages, current and temperatures on your phone, and change settings, without a cable.</td></tr>
          <tr><td>UART</td><td>A simple serial link for a PC or display, and for the BMS maker's own monitoring tools.</td></tr>
          <tr><td>RS485</td><td>A longer, more robust serial link, often used to read several batteries on one bus.</td></tr>
          <tr><td>CAN</td><td>A bus that lets the BMS tell a compatible inverter or charger what charge voltage and current to use.</td></tr>
        </tbody>
      </table>
      <h2>Which do you need?</h2>
      <ul>
        <li><strong>One pack and you want to look at it.</strong> Bluetooth with the maker's app is enough.</li>
        <li><strong>Several batteries in parallel.</strong> RS485 lets one device read them all, if your monitor supports it.</li>
        <li><strong>A hybrid solar inverter that talks to the battery.</strong> The inverter needs to support lithium communication, usually over CAN or RS485, and the BMS must speak the same protocol.</li>
      </ul>
      <h2>Check compatibility before you buy</h2>
      <p>Two devices having the same kind of port does not mean they understand each other. The messages on that port follow a protocol, and inverters list which battery brands and protocols they support. Ask the inverter maker for the compatible BMS list, and check that the BMS model offers the matching protocol.</p>
      <p>If your inverter has no communication with the battery, you do not need CAN or RS485. You just set the inverter's charge voltage by hand to suit the pack and let the BMS protect it, as covered in <a href="/blog/bms-for-24v-inverter-ups-8s-lfp-100amp-which-board.html">BMS for a 24V inverter and UPS</a>.</p>
      <h2>Models in our range</h2>
      <p>Some Daly smart BMS listings, such as the <a href="${p('DALY SMART 7S-24S - 100AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">Smart 7S-24S 100A</a> and the <a href="${p('DALY SMART 7S-24S - 40AMP BMS - Inbuilt Balancer &amp; Bluetooth - 485+Can')}">40A version</a>, mention Bluetooth, RS485 and CAN in the name. Check the product page and datasheet for the exact ports and protocols. For the choice between smart and hardware boards see <a href="/blog/smart-bms-vs-hardware-bms-daly-which-to-buy-india.html">Smart BMS vs Hardware BMS</a>.</p>`,
    faq: [
      ['Do I need CAN or RS485 for a normal e-bike pack?', 'No. Bluetooth or no communication is usually enough. The wired ports matter when a device has to read or control the battery.'],
      ['Will any CAN BMS work with my inverter?', 'No. The inverter must support the BMS protocol. Check the inverter maker\'s compatibility list.'],
      ['Can I monitor several batteries with Bluetooth?', 'The app normally connects to one BMS at a time. For many batteries on one screen look at RS485 and a monitor that supports it.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'bms-precharge-and-inverter-startup-why-a-new-pack-trips-on-switch-on',
    category: 'BMS', tag: 'BMS',
    title: 'Why a New Pack Trips When You Switch the Inverter On: Pre-Charge Explained',
    short: ['BMS Trips at Switch-On', 'Inrush current and pre-charge, explained'],
    description: 'Why a BMS cuts out the moment an inverter or motor controller is connected, how input capacitors cause inrush current, and the fixes: pre-charge resistor, soft start and a higher-rated BMS. Live prices from Arambhika, Noida.',
    keywords: 'BMS trips on inverter start, BMS precharge, inrush current inverter battery, BMS short circuit protection false trip, controller capacitor inrush',
    productsHeading: 'BMS models',
    intro: 'The pack tests fine, the BMS is rated for the current, and yet it shuts off the instant you connect the inverter. The cause is usually a brief surge, not a fault.',
    body: `
      <h2>What happens at switch-on</h2>
      <p>Inverters and motor controllers have large capacitors across their DC input. When you connect an empty capacitor to a battery, it draws a very large current for a few milliseconds while it charges. The BMS sees this as a short circuit and cuts the output, because to the BMS it looks like one.</p>
      <h2>Signs it is inrush, not a fault</h2>
      <ul>
        <li>The trip happens at the moment you connect or flip the switch, before any load is running.</li>
        <li>It happens with the inverter or controller, but not with a small test load.</li>
        <li>Once the BMS output is on, the system runs normally.</li>
      </ul>
      <h2>Three fixes</h2>
      <ol>
        <li><strong>Pre-charge.</strong> Charge the capacitors through a resistor first, then close the main connection. A pre-charge resistor in series with a switch, or a BMS with a pre-charge function, limits the surge. The resistor value and the time must suit the capacitance and voltage, so use the inverter maker's recommendation or the BMS manual.</li>
        <li><strong>Check the short-circuit setting.</strong> Smart BMS models let you adjust the delay of the short-circuit trip in their app. A very short delay trips on a brief surge. Do not disable protection, only tune the delay within the limits in the manual.</li>
        <li><strong>Pick a higher rating.</strong> A BMS with more headroom in its peak current can ride out a small surge. It does not remove the need to limit the inrush for a large inverter.</li>
      </ol>
      <h2>Do not bypass the BMS</h2>
      <p>Connecting the inverter straight to the cells to get past the trip removes your protection and can arc at the terminals. Solve the cause instead. If you are unsure, send us the inverter model, the pack voltage and the BMS you have.</p>
      <p>See also <a href="/blog/how-to-choose-bms-current-rating-lithium-battery-pack.html">choosing a BMS current rating</a> and the <a href="${p('DALY LFP 15S-100AMP SMART BMS')}">Daly LFP 15S 100A smart BMS</a> or the <a href="${p('DALY LFP 4S-300AMP SMART BMS')}">4S 300A</a> for high-current 12 V loads.</p>`,
    faq: [
      ['Is a trip at switch-on dangerous?', 'It is the BMS doing its job. The surge is real, so fix it with pre-charge or settings rather than removing the protection.'],
      ['What is a pre-charge resistor?', 'A resistor that limits the current while the input capacitors charge. After a short time a main switch closes and the resistor is bypassed.'],
      ['Will a bigger BMS fix it?', 'Sometimes, if the surge is small. For a large inverter the inrush should still be limited.'],
    ],
  }),

  // ---- Copper Bus Bar ----
  mk({
    ...NEW,
    slug: 'copper-busbar-20x2-mm-how-much-current-planning-guide',
    category: 'Copper Bus Bar', tag: 'Busbar',
    title: 'How Much Current Can a 20x2 mm Copper Busbar Carry? A Planning Guide',
    short: ['Copper Busbar Current Capacity', 'A planning guide for 20x2 mm tin-coated bars'],
    description: 'A way to estimate the current of a 20 x 2 mm tin-coated copper busbar, why joints and temperature set the real limit, and how to test a pack before you trust it. Live prices from Arambhika, Noida.',
    keywords: 'copper busbar current capacity, 20x2 mm busbar amps, busbar current per mm2, copper busbar battery pack current, tin coated copper busbar rating',
    productsHeading: 'Copper busbars',
    intro: 'There is no single current rating for a busbar. It depends on how hot you allow it to get, so here is a method that works.',
    body: `
      <h2>Start from the cross-section</h2>
      <p>A 20 mm wide, 2 mm thick bar has a cross-section of 40 mm<sup>2</sup>. For comparison, a 10 x 0.30 mm nickel strip is only 3 mm<sup>2</sup>, so the copper bar is more than 13 times larger, and copper conducts better than nickel as well.</p>
      <h2>A planning figure, not a rating</h2>
      <p>Designers often start by planning around roughly 1 to 1.5 amps per mm<sup>2</sup> of copper for continuous current in a bar with some air movement. For 40 mm<sup>2</sup> that is about 40 to 60 A as a starting estimate. Use it to choose a size to test, and not as a guarantee. The true figure depends on:</p>
      <ul>
        <li>how many bars are bundled together, and how much air reaches them,</li>
        <li>the enclosure and the ambient temperature,</li>
        <li>the length of the bar,</li>
        <li>the quality of the bolted joints at each end.</li>
      </ul>
      <h2>The joint is the weak spot</h2>
      <p>A bolted joint adds resistance. A loose or dirty joint heats up long before the bar does. Use clean mating faces, the right bolt, washer and torque for the stud, and re-check torque after the first few thermal cycles. See our <a href="/blog/busbar-bolt-torque-joint-resistance-checks-prismatic-cell-packs.html">torque and joint checks</a> post.</p>
      <h2>Test before you trust it</h2>
      <ol>
        <li>Build the connection as you plan to use it.</li>
        <li>Run the highest continuous current you expect for an hour or more.</li>
        <li>Check the temperature of the bar and of each joint with a thermometer or thermal camera.</li>
        <li>If the rise is more than you accept, go to a wider bar, add a parallel bar, or reduce the current.</li>
      </ol>
      <p>Bars in this range come in several lengths: <a href="${p('COPPER BUS BAR Universal (55x20x2mm) - Tin Coated')}">55 mm</a>, <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">60 mm</a>, <a href="${p('COPPER BUS BAR Universal (68x20x2mm)- Tin Coated')}">68 mm</a> and <a href="${p('COPPER BUS BAR Universal (82x20x2mm)- Tin Coated')}">82 mm</a>. Pick by cell pitch with our <a href="/blog/copper-busbar-lengths-55-60-68-82mm-universal-tin-coated-choose.html">length guide</a>.</p>`,
    faq: [
      ['What is the rated current of a 20x2 mm busbar?', 'There is no single rating. It depends on the allowed temperature rise, airflow and joints. Use a planning estimate, then test.'],
      ['Why does the joint matter more than the bar?', 'A joint has contact resistance. A poor one gets hot first and can fail even when the bar itself is fine.'],
      ['Can I stack two bars?', 'Yes, but stacked bars cool each other less. Test the temperature with the real arrangement.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'when-to-move-from-nickel-strip-to-copper-busbar',
    category: 'Copper Bus Bar', tag: 'Busbar',
    title: 'When to Move from Nickel Strip to a Copper Busbar',
    short: ['Nickel Strip or Copper Busbar?', 'A simple test for when strip is not enough'],
    description: 'How to decide between spot-welded nickel strip and bolted copper busbar: current, cell type, repairability and cost, with a clear rule of thumb. Live prices from Arambhika, Noida.',
    keywords: 'nickel strip vs copper busbar, when to use copper busbar, high current battery pack connection, busbar for prismatic cells, bolted vs welded battery connections',
    productsHeading: 'Copper busbars',
    intro: 'Nickel strip suits small cylindrical cells. Copper busbar suits large cells and high current. Between them lies a grey zone, and this is how to cross it.',
    body: `
      <h2>The cell decides first</h2>
      <ul>
        <li><strong>Small cylindrical cells (18650, 21700).</strong> The terminals are designed for spot-welded nickel strip. A bolted busbar has nothing to bolt to.</li>
        <li><strong>Large prismatic cells.</strong> These have bolt-on or weld-on terminals sized for busbars. Nickel strip is not the normal connection.</li>
        <li><strong>Large cylindrical cells (32650, 32140).</strong> Thicker nickel strip is common, but at high current builders also use busbars on a bolted design.</li>
      </ul>
      <h2>Current is the second test</h2>
      <p>A strip that is 10 mm wide and 0.30 mm thick has a cross-section of 3 mm<sup>2</sup>. A 20 x 2 mm copper bar has 40 mm<sup>2</sup>, and copper conducts better than nickel. If your pack current needs more conductor than a few strips in parallel can give, move to copper. Run the numbers with our <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">strip sizing guide</a> and the <a href="/blog/copper-busbar-20x2-mm-how-much-current-planning-guide.html">busbar planning guide</a>.</p>
      <h2>Other things that tip it</h2>
      <table class="blog-table">
        <thead><tr><th>Factor</th><th>Nickel strip</th><th>Copper busbar</th></tr></thead>
        <tbody>
          <tr><td>Joining</td><td>Spot or laser weld</td><td>Bolted (or welded for some designs)</td></tr>
          <tr><td>Repair</td><td>Hard: cut and re-weld</td><td>Easy: unbolt and replace</td></tr>
          <tr><td>Tools</td><td>Spot welder</td><td>Torque wrench</td></tr>
          <tr><td>Vibration</td><td>Good welds hold well</td><td>Needs correct torque and washers</td></tr>
        </tbody>
      </table>
      <h2>Rule of thumb</h2>
      <p>If your cells are small cylinders and the current per parallel group is modest, use nickel strip. If your cells are large with bolted terminals, or the current needs more conductor than strip can reasonably give, use copper. Not sure? Tell us the cell and the pack current on WhatsApp.</p>
      <p>Examples: <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">copper 60x20x2 mm</a> and <a href="${p('Nickel Strip Pure 1P 10x0.30 mm')}">pure nickel 1P 10x0.30 mm</a>.</p>`,
    faq: [
      ['Can I bolt a busbar to an 18650 cell?', 'No. Those cells have no bolt terminal. They are joined with spot-welded strip.'],
      ['Is copper always better than nickel?', 'It conducts better, but the right choice depends on the cell terminals, the current and how you assemble the pack.'],
      ['Which is cheaper?', 'It depends on the size and the number of joints. Compare the full set of parts for your pack, not just the per-piece price.'],
    ],
  }),

  // ---- Aluminium Busbar ----
  mk({
    ...NEW,
    slug: 'aluminium-busbar-laser-welding-or-bolting-on-prismatic-cells',
    category: 'Aluminium Busbar', tag: 'Busbar',
    title: 'Aluminium C2C Busbars: Laser Welded or Bolted? How to Decide',
    short: ['Aluminium Busbars: Weld or Bolt', 'Which joining method fits your cells'],
    description: 'How aluminium cell-to-cell busbars are joined to prismatic cell terminals, laser welding versus bolting, and what to check about your cells before you choose. Live prices from Arambhika, Noida.',
    keywords: 'aluminium busbar laser weld, C2C busbar prismatic, aluminium busbar bolted, laser weld prismatic cells, 1200 grade aluminium busbar',
    productsHeading: 'Aluminium C2C busbars',
    intro: 'The cell terminals decide how a busbar is joined. Before you buy busbars, look at your cells.',
    body: `
      <h2>What a C2C busbar does</h2>
      <p>A cell-to-cell (C2C) busbar links one cell terminal to the next. In a series busbar it joins the positive terminal of one cell to the negative of the next, so the voltages add. Our Model 1 busbars are made from 1200 grade aluminium and are about 84.5 x 25 x 1.5 mm.</p>
      <h2>Two ways to join it</h2>
      <ul>
        <li><strong>Laser welding.</strong> The busbar is welded to the terminal, giving a permanent, low-resistance joint with no loose fasteners. It needs a laser welder with the right setup, and is used for cells that have flat weld terminals. Cells sold as "laser weld" versions are intended for this.</li>
        <li><strong>Bolting.</strong> The busbar slips over terminal studs and is held by nuts at a set torque. It needs no welder, so a workshop can build and repair packs, but it needs clean surfaces and correct torque to stay tight.</li>
      </ul>
      <h2>Check your cells first</h2>
      <ol>
        <li>Look at the terminal. A flat, wide aluminium or copper pad suggests welding. A threaded stud or bolt hole suggests bolting.</li>
        <li>Read the datasheet. It states the terminal material and the recommended joining method.</li>
        <li>Measure the cell pitch and terminal spacing, and compare with the busbar size.</li>
      </ol>
      <h2>Which is right for you</h2>
      <table class="blog-table">
        <thead><tr><th>Situation</th><th>Choice</th></tr></thead>
        <tbody>
          <tr><td>You have access to a laser welder and build in volume</td><td>Laser welding</td></tr>
          <tr><td>You build or repair packs by hand</td><td>Bolting, if your cells have studs</td></tr>
          <tr><td>Your cells are "laser weld" types</td><td>Follow the maker's guidance on joining</td></tr>
        </tbody>
      </table>
      <p>Busbars available: <a href="${p('Aluminium Busbar Model 1 C2C Series')}">series</a>, <a href="${p('Aluminium Busbar Model 1 C2C Parallel')}">parallel</a> and <a href="${p('Aluminium Busbar Model 1 C2C L Shape')}">L shape</a>. See the <a href="/blog/aluminium-busbar-c2c-series-parallel-layouts-16s1p-8s2p-examples.html">layout guide</a> for series and parallel patterns.</p>`,
    faq: [
      ['Can I bolt a busbar to a laser-weld cell?', 'Only if the terminal is designed for it. Check the cell datasheet before choosing a method.'],
      ['What is a C2C busbar?', 'Cell-to-cell: it connects one cell terminal to the next.'],
      ['Which grade of aluminium is used?', 'Our Model 1 busbars are 1200 grade aluminium.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'aluminium-busbars-oxide-layer-and-mixed-metal-joints',
    category: 'Aluminium Busbar', tag: 'Busbar',
    title: 'Aluminium Busbars: Oxide Layers, Clean Joints and Mixed-Metal Care',
    short: ['Aluminium Busbar Joints', 'Oxide, cleaning and mixing metals safely'],
    description: 'Why aluminium busbars form an oxide film, how to prepare a clean low-resistance joint, and how to avoid corrosion where aluminium meets copper or steel. Live prices from Arambhika, Noida.',
    keywords: 'aluminium busbar oxide, aluminium copper joint corrosion, galvanic corrosion busbar, clean aluminium busbar joint, aluminium busbar contact resistance',
    productsHeading: 'Aluminium busbars',
    intro: 'Aluminium is light and cheap, but its surface behaves differently from copper. A little care at the joint pays off.',
    body: `
      <h2>The oxide film</h2>
      <p>As soon as aluminium is exposed to air it forms a very thin, hard oxide layer. This layer protects the metal underneath, but it does not conduct well. A joint made over a thick or dirty oxide layer has higher resistance and runs hotter than it should.</p>
      <h2>Preparing a joint</h2>
      <ol>
        <li>Clean the mating faces of dirt and grease with a lint-free cloth and isopropyl alcohol.</li>
        <li>If the surface is visibly dull, remove the oxide just before assembly with a fine abrasive pad, in one direction, and wipe off the dust.</li>
        <li>Assemble soon after cleaning, since the oxide begins to re-form in minutes.</li>
        <li>Use the washers and torque recommended for the stud, and re-check the torque after the first heat cycles.</li>
        <li>For welded joints, follow the welder's cleaning and shielding guidance, since contamination causes weak welds.</li>
      </ol>
      <h2>Where aluminium meets other metals</h2>
      <p>When two different metals touch in a damp environment, the more reactive one corrodes faster. This is called galvanic corrosion. Aluminium is more reactive than copper, tin and steel, so an aluminium busbar bolted to a copper terminal can corrode at the joint in a humid place such as a coastal area or a monsoon-exposed enclosure.</p>
      <ul>
        <li>Keep joints dry, and seal the enclosure against moisture.</li>
        <li>Use hardware made for the combination, such as plated washers, and avoid mixing metals where you can.</li>
        <li>Inspect joints periodically for white powder, discolouration or heat marks.</li>
      </ul>
      <p>Our <a href="/blog/copper-vs-aluminium-busbar-battery-pack-which-to-choose.html">copper vs aluminium comparison</a> covers cost and weight. For joining methods see <a href="/blog/aluminium-busbar-laser-welding-or-bolting-on-prismatic-cells.html">laser welding or bolting</a>. Busbars in this range: <a href="${p('Aluminium Busbar Model 1 C2C Series')}">Model 1 C2C series</a> and <a href="${p('Aluminium Busbar Model 1 C2C L Shape')}">L shape</a>.</p>`,
    faq: [
      ['Do I need to sand aluminium before bolting?', 'Clean it first. If the surface is dull, a fine abrasive pad removes oxide just before assembly. Do not leave it for hours.'],
      ['Can aluminium touch copper?', 'It can, but in damp conditions the joint can corrode. Keep it dry and use suitable hardware.'],
      ['Why does a joint get warm?', 'A high-resistance joint, from oxide, dirt or low torque, turns current into heat. Clean it and check the torque.'],
    ],
  }),

  // ---- Epoxy Board ----
  mk({
    ...NEW,
    slug: 'epoxy-sheet-thickness-guide-0-5-0-8-1-and-2-mm',
    category: 'Epoxy Board', tag: 'Insulation',
    title: 'FR-4 Epoxy Sheet Thickness Guide: 0.5, 0.8, 1 and 2 mm',
    short: ['Epoxy Sheet Thickness Guide', 'Which of 0.5, 0.8, 1 or 2 mm to choose'],
    description: 'Choose between 0.5, 0.8, 1 and 2 mm FR-4 epoxy sheet for battery pack insulation, with approximate weight per 502 x 338 mm sheet and how many sheets are in a 5 kg minimum order. Live prices from Arambhika, Noida.',
    keywords: 'FR-4 epoxy sheet thickness, epoxy sheet 1mm battery, epoxy sheet weight, glass epoxy insulation sheet India, 502x338 epoxy sheet',
    productsHeading: 'Epoxy sheets',
    intro: 'The same sheet size comes in four thicknesses. A thicker sheet is stiffer and heavier, and a thinner one is easier to cut and fit.',
    body: `
      <h2>About the material</h2>
      <p>FR-4 is fibreglass cloth soaked in epoxy resin and pressed under heat. Our sheets are 502 x 338 mm and, per the product data, are flame retardant to UL 94 V-0, with high dielectric strength and a glass transition temperature of 127 &deg;C. They are sold per kg, with a 5 kg minimum.</p>
      <h2>Approximate weight per sheet</h2>
      <p>FR-4 has a density of about 1.85 g/cm<sup>3</sup>. A 502 x 338 mm sheet has an area of 1697 cm<sup>2</sup>, so:</p>
      <table class="blog-table">
        <thead><tr><th>Thickness</th><th>Weight per sheet, about</th><th>Sheets in 5 kg, about</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td>0.5 mm</td><td>157 g</td><td>32</td><td>Thin insulating barriers and liners</td></tr>
          <tr><td>0.8 mm</td><td>251 g</td><td>20</td><td>Barriers that need a little stiffness</td></tr>
          <tr><td>1 mm</td><td>314 g</td><td>16</td><td>Insulating plates, spacers, BMS mounting</td></tr>
          <tr><td>2 mm</td><td>628 g</td><td>8</td><td>Rigid end plates and structural spacers</td></tr>
        </tbody>
      </table>
      <p>These are estimates from density, so actual weights vary a little.</p>
      <h2>How to choose</h2>
      <ul>
        <li><strong>Insulating between a busbar and a metal case.</strong> Go for 0.5 or 0.8 mm. Thin sheet is enough, and it follows the shape better.</li>
        <li><strong>Mounting a BMS or a plate that gets screwed down.</strong> Use 1 mm or more, so it does not flex.</li>
        <li><strong>Pack end plates or spacers that take load.</strong> Use 2 mm.</li>
        <li><strong>Unsure.</strong> Order a small quantity of two thicknesses and test the fit in your enclosure.</li>
      </ul>
      <p>Sheets in our range: <a href="${p('EPOXY SHEET (502*338*0.5MM)')}">0.5 mm</a>, <a href="${p('EPOXY SHEET (502*338*0.8MM)')}">0.8 mm</a>, <a href="${p('EPOXY SHEET (502*338*1MM)')}">1 mm</a> and <a href="${p('EPOXY SHEET (502*338*2MM)')}">2 mm</a>. See also our post on <a href="/blog/epoxy-sheet-insulation-battery-pack-thickness-guide.html">epoxy sheet in battery packs</a> and how to <a href="/blog/machining-fr4-epoxy-sheet-cutting-drilling-and-dust-safety.html">cut it safely</a>.</p>`,
    faq: [
      ['What does UL 94 V-0 mean?', 'It is a flammability rating. V-0 is the best of the vertical burn classes, meaning the material stops burning quickly.'],
      ['How many sheets are in the minimum order?', 'At 5 kg, about 16 sheets of 1 mm, but the number depends on thickness. See the table.'],
      ['Can I cut the sheet to size?', 'Yes, with the right tools and dust control. See our cutting guide.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'machining-fr4-epoxy-sheet-cutting-drilling-and-dust-safety',
    category: 'Epoxy Board', tag: 'Insulation',
    title: 'Cutting and Drilling FR-4 Epoxy Sheet Safely: Tools, Dust and Finish',
    short: ['Cutting FR-4 Epoxy Sheet', 'Tools, dust control and a clean finish'],
    description: 'How to cut, drill and finish FR-4 glass epoxy sheet: sharp carbide tools, supporting the sheet, dust extraction and a mask, deburring edges and keeping hole edges clean. Live prices from Arambhika, Noida.',
    keywords: 'cut FR-4 sheet, drill glass epoxy sheet, epoxy sheet dust safety, machining FR4, deburr epoxy sheet',
    productsHeading: 'Epoxy sheets',
    intro: 'FR-4 cuts well, but it is glass-filled. That dulls tools quickly and the dust is not something to breathe.',
    body: `
      <h2>Protect yourself first</h2>
      <p>Cutting or sanding FR-4 makes fine dust containing glass fibre and cured resin. It irritates skin, eyes and lungs.</p>
      <ul>
        <li>Wear a dust mask rated for fine particles, eye protection and gloves.</li>
        <li>Cut where dust is pulled away, with a vacuum or extraction at the tool. Do not blow it off with air.</li>
        <li>Clean up with a vacuum, or a damp cloth, not a dry brush.</li>
        <li>Keep it away from food and wash your hands after.</li>
      </ul>
      <h2>Choosing the tool</h2>
      <table class="blog-table">
        <thead><tr><th>Job</th><th>Tool</th></tr></thead>
        <tbody>
          <tr><td>Straight cuts, thin sheet</td><td>Fine-tooth saw, or a guillotine shear for thin sheet</td></tr>
          <tr><td>Straight cuts, thicker sheet</td><td>Circular or jig saw with a carbide-tipped or diamond blade</td></tr>
          <tr><td>Holes</td><td>Sharp carbide drill bits, with the sheet clamped and backed</td></tr>
          <tr><td>Shapes and slots</td><td>A router or CNC with a carbide cutter</td></tr>
        </tbody>
      </table>
      <p>Ordinary steel bits and blades dull fast on glass-filled material. Plan on carbide or diamond for any volume.</p>
      <h2>Getting a clean edge</h2>
      <ol>
        <li>Mark the line, and support the sheet close to the cut so it does not flex or chip.</li>
        <li>Clamp it down. A vibrating sheet cracks and chips along the cut.</li>
        <li>Feed steadily and do not force the tool. Let the cutter work.</li>
        <li>Put a scrap sheet underneath when drilling, so the exit side of the hole does not break out.</li>
        <li>Deburr edges and hole rims lightly with fine sandpaper, and wipe clean.</li>
      </ol>
      <h2>Check the result</h2>
      <p>Look for chipped edges and hairline cracks, particularly near holes. A sheet with a crack running to the edge should not be used as an insulating part, since it can propagate. Keep cut sheet dry and clean before assembly.</p>
      <p>Choose thickness first with our <a href="/blog/epoxy-sheet-thickness-guide-0-5-0-8-1-and-2-mm.html">thickness guide</a>. Sheets: <a href="${p('EPOXY SHEET (502*338*1MM)')}">502 x 338 x 1 mm</a> and the large <a href="${p('EPOXY SHEET (512*1225*0.5MM)')}">512 x 1225 x 0.5 mm</a>.</p>`,
    faq: [
      ['Do I need a mask to cut FR-4?', 'Yes. The dust contains glass fibre. Use a suitable mask, eye protection and extraction.'],
      ['Can I cut it with a normal wood blade?', 'You can, but it will dull quickly. A carbide-tipped or diamond blade lasts far longer.'],
      ['Why does the hole edge chip?', 'The drill breaks out of the back face. Back the sheet with a scrap board and feed slowly.'],
    ],
  }),
]
