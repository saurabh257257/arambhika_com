// Category posts, part C: cell holders, potting compound, tapes and connectors (two posts for each category).
import { p, mk } from './blog-products-lib.mjs'

const NEW = { date: '2026-11-23', dateLabel: '23 November 2026', strict: true }

export const posts = [
  // ---- Cell Holder ----
  mk({
    ...NEW,
    slug: 'how-many-cell-holders-do-you-need-1x2-holder-count-by-pack',
    category: 'Cell Holder', tag: 'Cell Holders',
    title: 'How Many Cell Holders Do You Need? The 1x2 Holder Count for Any Pack',
    short: ['How Many Cell Holders?', 'Holder count for any cylindrical pack'],
    description: 'Work out how many 1x2 cell holders a cylindrical pack needs for 18650, 21700, 26650, 32650, 33140 and 34145 cells, with worked examples and a note on minimum orders. Live prices from Arambhika, Noida.',
    keywords: 'how many cell holders, 18650 cell holder 1x2 count, 21700 holder quantity, battery pack cell holder calculator, cell spacer count',
    productsHeading: 'Cell holders',
    intro: 'A 1x2 holder holds two cells side by side. Counting how many you need takes one division.',
    body: `
      <h2>The rule</h2>
      <p>Each 1x2 holder carries two cells, so the number of holders is the number of cells in the pack divided by two, rounded up. An odd cell count leaves one holder with a single cell. That is fine, but it is worth planning for.</p>
      <h2>Worked examples</h2>
      <table class="blog-table">
        <thead><tr><th>Pack</th><th>Cells</th><th>Holders (1x2)</th></tr></thead>
        <tbody>
          <tr><td>10S4P, 18650</td><td>40</td><td>20</td></tr>
          <tr><td>13S5P, 21700</td><td>65</td><td>33 (one holds a single cell)</td></tr>
          <tr><td>16S2P, 32140 or 32650</td><td>32</td><td>16</td></tr>
          <tr><td>8S4P, 26650</td><td>32</td><td>16</td></tr>
        </tbody>
      </table>
      <p>Not sure how many cells your pack needs? Use the <a href="/blog/how-many-18650-21700-cells-for-your-pack-cell-count-calculator.html">cell count calculator</a> first.</p>
      <h2>Match the holder to the cell</h2>
      <p>The holder is made for one cell size. Our 1x2 holders cover six cylindrical formats: <a href="${p('CELL HOLDER 18650 (1X2)')}">18650</a>, <a href="${p('CELL HOLDER 21700 (1X2)')}">21700</a>, <a href="${p('CELL HOLDER 26650 (1X2)')}">26650</a>, <a href="${p('CELL HOLDER 32650 (1X2)')}">32650</a>, <a href="${p('CELL HOLDER 33140 (1X2)')}">33140</a> and <a href="${p('CELL HOLDER 34145 (1X2)')}">34145</a>. A holder for the wrong size will not hold cells properly, so check your cell's diameter and length first. Cells such as 32140 LFP are a different size from the formats listed, so ask us if the holder suits your cell.</p>
      <h2>Minimum orders</h2>
      <p>Holders are sold per piece with a minimum order that depends on the size, from 100 to 500 pieces. Count what you need for a batch of packs and add a few percent for breakage and test builds.</p>
      <h2>What the holder does</h2>
      <p>The holder keeps cells in place, cuts vibration and leaves a gap between cells that helps heat escape. It does not replace the insulation between cells and strip, and it does not hold the cells to the case, so plan for both. See <a href="/blog/cell-holders-18650-21700-32650-battery-pack-guide.html">Cell Holders for Battery Packs</a> for more.</p>`,
    faq: [
      ['Do I count holders or cells when I order?', 'Holders. A 1x2 holder carries two cells, so divide your cell count by two and round up.'],
      ['Can I use an 18650 holder for a 21700 cell?', 'No. Each holder fits one cell size.'],
      ['Should I order extra?', 'A few percent extra covers test builds and breakage.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'assembling-a-cylindrical-battery-pack-holders-insulation-strip-order',
    category: 'Cell Holder', tag: 'Cell Holders',
    title: 'Assembling a Cylindrical Pack: Holders, Insulation Paper and Strip in the Right Order',
    short: ['Cylindrical Pack Assembly Order', 'From holders to welded strip, step by step'],
    description: 'The order for building a cylindrical battery pack: cell holders, polarity, insulation paper, nickel strip, spot welding, checks and wrapping. A checklist you can follow. Live prices from Arambhika, Noida.',
    keywords: 'cylindrical battery pack assembly steps, assemble 18650 pack holders insulation strip, battery pack build order, cell holder insulation paper nickel strip',
    productsHeading: 'Parts used in this build',
    intro: 'Getting the order right avoids rework. This is a sequence many pack builders follow, with a check at each stage.',
    body: `
      <h2>Before you start</h2>
      <ul>
        <li>Have a drawing of the layout with polarity marked for every cell.</li>
        <li>Check every cell for voltage and damage on arrival, and match them within the pack.</li>
        <li>Work on a clean, dry, non-conductive surface, and remove rings and metal jewellery.</li>
      </ul>
      <h2>The sequence</h2>
      <ol>
        <li><strong>Fit the holders.</strong> Snap cells into <a href="${p('CELL HOLDER 18650 (1X2)')}">cell holders</a> in the layout you drew. Check the polarity of every cell against the drawing before going on.</li>
        <li><strong>Add insulation paper.</strong> Fit the die-cut insulation, such as <a href="${p('Insulation Paper 18650')}">insulation paper for 18650</a> or <a href="${p('Insulation Paper 21700')}">for 21700</a>, at the end of the cell where it keeps the terminal region apart from nearby conductive parts.</li>
        <li><strong>Lay the strip.</strong> Place the nickel strip on the terminals. Choose the strip for your cell format and current. See <a href="/blog/how-to-calculate-nickel-strip-size-battery-pack-current.html">sizing nickel strip</a>.</li>
        <li><strong>Test-weld.</strong> Make a few welds on a spare cell and pull-test them. Adjust the welder until the strip tears before the weld fails.</li>
        <li><strong>Weld the pack.</strong> Follow our <a href="/blog/spot-weld-nickel-strip-18650-21700-battery-pack-guide.html">spot-welding guide</a>. Weld in a pattern that does not heat one cell too long.</li>
        <li><strong>Inspect.</strong> Look at every weld and tug each strip lightly. Re-weld weak spots.</li>
        <li><strong>Check voltages.</strong> Measure each series group and compare. A group that reads off points to a wrong orientation or a bad weld.</li>
        <li><strong>Connect the BMS.</strong> Wire the balance leads in order, following the BMS manual. See <a href="/blog/bms-wiring-guide-balance-leads-main-cables-order-of-connection.html">how to wire a BMS</a>.</li>
        <li><strong>Insulate and wrap.</strong> Cover bare strip ends and sharp edges, then wrap the pack with tape or sleeve.</li>
        <li><strong>Test.</strong> Charge and discharge at a low current first, and check for heat at the welds and the BMS.</li>
      </ol>
      <h2>Common slips</h2>
      <ul>
        <li>A cell in backwards. Check polarity before welding, not after.</li>
        <li>A strip that bridges two groups that should not touch. Look for contact at the edges.</li>
        <li>Skipping the test welds, then finding weak welds in the finished pack.</li>
      </ul>`,
    faq: [
      ['Do I fit insulation before or after the holders?', 'Fit the holders first so the cells are in place, then add the insulation paper where your design needs it.'],
      ['Why test-weld first?', 'Settings vary with the strip, the cell and the welder. A pull test on a spare cell shows if the welds are strong before you weld the real pack.'],
      ['Which tape or sleeve do I use at the end?', 'See our tape guide for pack assembly.'],
    ],
  }),

  // ---- Potting Compound ----
  mk({
    ...NEW,
    slug: 'potting-compound-mixing-and-pouring-two-part-1-to-1-silicone-gel',
    category: 'Potting Compound', tag: 'Potting',
    title: 'Mixing and Pouring Two-Part Silicone Potting Gel: A 1:1 Guide',
    short: ['Mixing a 1:1 Potting Gel', 'Prepare, mix, pour and cure in order'],
    description: 'How to use a two-part 1:1 silicone potting gel on a BMS board or module: preparing the part, measuring A and B, mixing, pouring and curing, plus common mistakes. Live prices from Arambhika, Noida.',
    keywords: 'two part silicone potting gel, 1:1 potting compound mixing, potting BMS board, thermally conductive potting gel India, how to pot electronics',
    productsHeading: 'Potting compound',
    intro: 'A two-part gel only works if the two parts are mixed in the right ratio and poured into a clean, dry part. The steps are simple.',
    body: `
      <h2>About this gel</h2>
      <p>Our 9606 is a two-part potting gel with a 1:1 mix ratio. It is thermally conductive, soft and low in viscosity, so it flows into small gaps, cushions shock and helps move heat away from the electronics. It is supplied in 25 kg buckets, with a minimum order of 100 kg.</p>
      <p>This is a general guide. The datasheet is the authority on pot life, cure time and temperature limits, and you should follow it.</p>
      <h2>Step by step</h2>
      <ol>
        <li><strong>Prepare the part.</strong> It should be clean, dry and free of flux residue and oil. Mask connectors, switches and anything that must stay free of gel.</li>
        <li><strong>Make a mould or use the case.</strong> Seal the gaps in the housing so the liquid cannot run out, and place the part level.</li>
        <li><strong>Measure A and B.</strong> Weigh the parts on a scale and keep the 1:1 ratio. Confirm in the datasheet whether the ratio is by weight or by volume. For 200 g of mixed gel, use 100 g of each.</li>
        <li><strong>Mix.</strong> Stir slowly and thoroughly, scraping the sides and bottom of the container. A streaky mix will not cure evenly. Do not whip air into it.</li>
        <li><strong>Pour.</strong> Pour slowly into one corner so the gel flows around components and pushes air out. Cover the parts to the level you planned.</li>
        <li><strong>Cure.</strong> Leave it undisturbed for the time and temperature in the datasheet. Do not power the part until cured.</li>
      </ol>
      <h2>Common mistakes</h2>
      <ul>
        <li>Wrong ratio, from measuring by eye. Use a scale.</li>
        <li>Mixing too much at once, so the gel starts to set before you have poured it. Mix what you can use in the pot life.</li>
        <li>Pouring onto a damp board, which traps moisture under the gel.</li>
        <li>Trapped air bubbles. Pour slowly, and vacuum degas if the datasheet suggests it.</li>
      </ul>
      <h2>Safety</h2>
      <p>Wear gloves and eye protection, work with ventilation, and read the safety data sheet. Keep the parts and mixing tools out of food use.</p>
      <p>Product: <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)</a>. See also <a href="/blog/silicone-potting-compound-battery-pack-bms-protection-india.html">Potting Compound for Battery Packs</a>.</p>`,
    faq: [
      ['What does 1:1 mean?', 'Equal parts of Part A and Part B. Check whether the datasheet means by weight or by volume.'],
      ['How long do I have to pour?', 'That is the pot life, and it is in the datasheet. Mix only as much as you can pour in that time.'],
      ['Can I pot a live board?', 'No. Wait until the gel has cured before you power the part.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'to-pot-or-not-to-pot-a-battery-pack-weight-heat-repair',
    category: 'Potting Compound', tag: 'Potting',
    title: 'To Pot or Not to Pot: When Potting a Battery Pack Pays Off',
    short: ['Should You Pot Your Pack?', 'Weight, heat, repair and cost compared'],
    description: 'A balanced look at potting a BMS or battery module: protection from moisture and vibration against weight, cost and repairability, with a simple way to decide. Live prices from Arambhika, Noida.',
    keywords: 'should I pot my BMS, potting battery pack pros and cons, potting vs not potting, potting repairability, silicone gel BMS potting',
    productsHeading: 'Potting compound',
    intro: 'Potting is not always the right answer. It adds protection, and it also adds weight, cost and a harder repair.',
    body: `
      <h2>What potting gives you</h2>
      <ul>
        <li><strong>Protection from moisture and dust.</strong> The gel seals components, which helps in humid or dusty places.</li>
        <li><strong>Vibration and shock damping.</strong> A soft gel cushions components and solder joints on e-bikes, tools and vehicles.</li>
        <li><strong>Electrical insulation.</strong> It fills gaps between conductors and reduces the risk of arcing in tight spaces.</li>
        <li><strong>Heat transfer.</strong> A thermally conductive gel carries heat away from hot parts toward the case.</li>
      </ul>
      <h2>What it costs you</h2>
      <ul>
        <li><strong>Weight.</strong> A full pot adds a lot of mass.</li>
        <li><strong>Cost and time.</strong> The compound, the mixing, the mould and the cure time all add up.</li>
        <li><strong>Repair.</strong> A soft gel can be dug out, but it is slower than opening an unpotted board, and a rigid resin would be harder.</li>
        <li><strong>Inspection.</strong> You cannot see solder joints or discoloured parts through the gel.</li>
      </ul>
      <h2>A simple way to decide</h2>
      <table class="blog-table">
        <thead><tr><th>If your pack is</th><th>Lean towards</th></tr></thead>
        <tbody>
          <tr><td>Outdoors, on a vehicle or near water</td><td>Potting the BMS or module</td></tr>
          <tr><td>Indoors in a sealed cabinet, low vibration</td><td>Not potting, or a conformal coating</td></tr>
          <tr><td>A prototype or a pack you may repair</td><td>Not potting yet</td></tr>
          <tr><td>High power density with little airflow</td><td>Thermally conductive potting</td></tr>
        </tbody>
      </table>
      <h2>Options between the two</h2>
      <p>A conformal coating protects a board with a thin film and little weight. See <a href="/blog/potting-compound-vs-conformal-coating-battery-electronics-protection.html">Potting vs Conformal Coating</a>. You can also pot only the part that needs it, such as the BMS, and leave the cells and strips open.</p>
      <p>If you decide to pot, see our <a href="/blog/potting-compound-mixing-and-pouring-two-part-1-to-1-silicone-gel.html">mixing and pouring guide</a> and the product: <a href="${p('Two-Part Silicone Potting Compound (1:1, Thermally Conductive Gel)')}">two-part silicone potting gel</a>.</p>`,
    faq: [
      ['Is potting required for a BMS?', 'No. It is a choice that depends on moisture, vibration and heat in your use.'],
      ['Can potted parts be repaired?', 'A soft gel can be removed with care, but it takes longer than repairing an open board.'],
      ['Does potting stop a pack from catching fire?', 'No. It protects the electronics from moisture and shock. A fire risk is managed with proper cells, BMS and design.'],
    ],
  }),

  // ---- Tapes ----
  mk({
    ...NEW,
    slug: 'kapton-tape-in-battery-packs-where-to-use-polyimide-tape',
    category: 'Tapes', tag: 'Tapes',
    title: 'Kapton Tape in Battery Packs: Where to Use Polyimide Tape',
    short: ['Kapton Tape for Battery Packs', 'Where polyimide tape earns its place'],
    description: 'Where Kapton polyimide tape is useful in a battery pack: protecting strip ends, insulating near welds and holding parts during soldering, and when a cheaper tape will do. Live prices from Arambhika, Noida.',
    keywords: 'Kapton tape battery pack, polyimide tape insulation, Kapton tape 25mm 50mm, high temperature insulation tape, battery pack insulation tape India',
    productsHeading: 'Kapton tape',
    intro: 'Kapton is the brand name for polyimide film tape. It is thin, strong and handles heat that would melt ordinary tapes.',
    body: `
      <h2>Why it is used</h2>
      <p>Polyimide film is a good electrical insulator, stays stable at high temperatures and stays thin. In a battery pack those three qualities matter, because space is tight and parts near welds and solder joints get hot. Check the datasheet of your roll for its voltage and temperature ratings before you rely on it for a specific job.</p>
      <h2>Good places to use it</h2>
      <ul>
        <li><strong>Covering strip ends and cut edges</strong> so they cannot touch the next cell or the case.</li>
        <li><strong>Insulating between the top of the cells and a BMS or board</strong> that sits on the pack.</li>
        <li><strong>Protecting wires and solder joints</strong> near welds and soldering points.</li>
        <li><strong>Masking and holding parts</strong> during soldering, since it tolerates the heat.</li>
        <li><strong>Insulating the weld area</strong> of a joint you have finished and inspected.</li>
      </ul>
      <h2>Where it is not the best choice</h2>
      <ul>
        <li><strong>Strapping and holding cells together.</strong> It is thin and not made for tension. Use filament tape.</li>
        <li><strong>Mounting a board.</strong> Use double-sided tape.</li>
        <li><strong>Large wrapping jobs.</strong> It costs more per metre than PVC tape, so save it for the jobs that need it.</li>
      </ul>
      <h2>Using it well</h2>
      <ol>
        <li>Clean and dry the surface first.</li>
        <li>Apply it flat, pressing out air bubbles, and overlap each turn by a few millimetres.</li>
        <li>Fold the tape over edges, and do not leave corners lifting.</li>
        <li>Keep it clear of weld spots, because it can get in the way of electrodes.</li>
      </ol>
      <p>We stock <a href="${p('Kapton Tape - 25mmX33mtr')}">25 mm x 33 m</a> and <a href="${p('Kapton Tape - 50mmX33mtr')}">50 mm x 33 m</a> rolls. See our <a href="/blog/battery-pack-tapes-which-tape-for-which-job.html">tape guide</a> for the other kinds.</p>`,
    faq: [
      ['Is Kapton tape a brand or a material?', 'Kapton is a brand of polyimide film. Tapes of this kind are often called Kapton tape.'],
      ['Can it replace all other tapes?', 'No. It is excellent for heat and insulation, but not for strapping or mounting.'],
      ['Which width should I choose?', 'Use 25 mm for narrow jobs such as strip ends and wires, and 50 mm for larger surfaces.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'battery-pack-tapes-which-tape-for-which-job',
    category: 'Tapes', tag: 'Tapes',
    title: 'Battery Pack Tapes: Which Tape for Which Job',
    short: ['Which Tape for Which Job', 'Kapton, PVC, filament, double-sided and more'],
    description: 'A guide to the tapes used around battery packs: Kapton, PVC, filament, double-sided, masking, duct and packing tape, what each does well and where not to use it. Live prices from Arambhika, Noida.',
    keywords: 'tape for battery pack, filament tape vs duct tape, PVC insulation tape battery, double sided tape BMS mounting, masking tape welding',
    productsHeading: 'Tapes',
    intro: 'Seven tapes, seven jobs. Using the right one makes a neater and safer pack.',
    body: `
      <h2>At a glance</h2>
      <table class="blog-table">
        <thead><tr><th>Tape</th><th>Best for</th><th>Avoid for</th></tr></thead>
        <tbody>
          <tr><td><a href="${p('Kapton Tape - 25mmX33mtr')}">Kapton (polyimide)</a></td><td>Heat-resistant insulation near welds and solder joints, covering strip ends</td><td>Strapping, mounting</td></tr>
          <tr><td><a href="${p('PVC Tape - 18mmX25mtr')}">PVC insulation tape</a></td><td>Insulating and bundling wires, finishing joints</td><td>Hot areas near welds</td></tr>
          <tr><td><a href="${p('Filament Tape - 24mmX50mtr')}">Filament tape</a></td><td>Strapping cells and bundles, since it has fibre reinforcement</td><td>Electrical insulation on its own</td></tr>
          <tr><td><a href="${p('Double Side Tape - 24mmX10mtr')}">Double-sided tape</a></td><td>Mounting a BMS or board, fixing parts without screws</td><td>Parts that carry load</td></tr>
          <tr><td><a href="${p('Masking Tape - 24mmX50mtr')}">Masking tape</a></td><td>Temporary holding and marking during assembly</td><td>Permanent fixing, heat</td></tr>
          <tr><td><a href="${p('Duct Tape - 48mmX50mtr')}">Duct tape</a></td><td>General workshop use, repairs, sealing</td><td>Insulating electrical parts</td></tr>
          <tr><td><a href="${p('SELF ADHESIVES TAPE PACKING BROWN')}">Packing tape</a></td><td>Sealing cartons for dispatch</td><td>Anything inside the pack</td></tr>
        </tbody>
      </table>
      <h2>Notes on the three you will use most</h2>
      <p><strong>Filament tape</strong> is fibre-reinforced for high tensile strength along its length, so it holds cell bundles together better than plain tape. <strong>Double-sided tape</strong> joins two surfaces without screws and is suited to mounting boards and light parts. <strong>PVC tape</strong> is a flexible self-adhesive insulation tape that conforms around wires and joints.</p>
      <h2>Rules that apply to all of them</h2>
      <ul>
        <li>Surfaces must be clean, dry and free of oil for any adhesive to hold.</li>
        <li>Adhesive tapes can soften with heat over time. Do not trust them as the only mechanical hold on cells in a hot pack. Combine them with holders and a case.</li>
        <li>Never use a tape in place of proper insulation between conductors at different voltages. Use insulation paper or sheet, covered in our <a href="/blog/assembling-a-cylindrical-battery-pack-holders-insulation-strip-order.html">pack assembly guide</a>.</li>
      </ul>
      <p>Read more about the heat-resistant tape in <a href="/blog/kapton-tape-in-battery-packs-where-to-use-polyimide-tape.html">Kapton Tape in Battery Packs</a>.</p>`,
    faq: [
      ['Can I use duct tape to insulate a battery?', 'It is not made as an electrical insulator. Use PVC tape, Kapton tape or proper insulation paper.'],
      ['Which tape holds cells together best?', 'Filament tape, because of its fibre reinforcement. Use it together with cell holders.'],
      ['Which tape is for mounting a BMS?', 'Double-sided tape, for light boards. Add a screw or strap for anything heavy.'],
    ],
  }),

  // ---- Connectors ----
  mk({
    ...NEW,
    slug: 'sb50-connector-sets-with-thimbles-how-to-choose-and-crimp',
    category: 'Connectors', tag: 'Connectors',
    title: 'SB50 Connector Sets: How to Choose, Crimp and Wire Them',
    short: ['SB50 Connector Sets', 'Choose the set, crimp it, wire it safely'],
    description: 'How to choose between SB50 connector sets with different thimbles, match them to wire size and current, crimp correctly and keep polarity right on battery and charger leads. Live prices from Arambhika, Noida.',
    keywords: 'SB50 connector, SB50 thimble crimp, 50 amp battery connector, SB50 wiring polarity, Anderson style connector battery',
    productsHeading: 'SB50 connector sets',
    intro: 'An SB50 is a compact two-pole plug in the 50-amp class, used on batteries, chargers and inverter leads. It lets you disconnect a pack without cutting wires.',
    body: `
      <h2>What is in a set</h2>
      <p>A set holds the plastic housings and the metal contacts. The contacts here are crimped on the wire end. We list sets with two different thimbles, so choose by the wire you will use.</p>
      <h2>Choosing the set</h2>
      <ol>
        <li><strong>Check the wire size.</strong> The thimble has a range of wire sizes it accepts. Open the product page for the set, or ask us, and match it to your wire. Our <a href="/blog/silicone-wire-gauge-guide-awg-mm2-resistance-and-voltage-drop.html">silicone wire guide</a> lists the common sizes.</li>
        <li><strong>Check the current.</strong> The connector is a 50-amp class part. Your wire, fuse and BMS should be sized so the current stays below the connector rating, with margin.</li>
        <li><strong>Think about both ends.</strong> Charger and battery leads that plug together must use compatible connectors.</li>
      </ol>
      <h2>Crimping</h2>
      <ul>
        <li>Strip only the length the contact needs, and keep all wire strands in the barrel.</li>
        <li>Use a crimp tool made for this type of contact. Pliers crush the barrel unevenly and give a poor joint.</li>
        <li>Tug the wire hard after crimping. If it moves, cut it off and redo it.</li>
        <li>Fit the contact into the housing until it clicks, and check it cannot be pulled out.</li>
      </ul>
      <h2>Polarity and safety</h2>
      <ul>
        <li>Keep a fixed convention across all your packs and chargers, for example red for positive and black for negative, and check it with a meter before connecting.</li>
        <li>Put a fuse close to the battery, on the positive lead.</li>
        <li>Never leave a live pack with an exposed contact. Cover unused connectors with their cap or tape.</li>
      </ul>
      <p>Sets in our range: <a href="${p('SB50 Connector Set With 6 Thimble')}">SB50 with 6 thimble</a> and <a href="${p('SB50 Connector Set with 10/12 Thimble')}">SB50 with 10/12 thimble</a>. Wire to match: <a href="${p('Silicone Wire 10AWG Red')}">10 AWG red</a> and <a href="${p('Silicone Wire 10AWG Black')}">black</a>.</p>`,
    faq: [
      ['What is a thimble?', 'The metal contact crimped onto the wire. Different thimbles suit different wire sizes.'],
      ['Can I solder instead of crimping?', 'Use the crimp method the connector is designed for. If you solder, do it as the maker recommends and never leave a cold joint.'],
      ['How do I know which set fits my wire?', 'Check the wire range on the product page, or send us your wire size on WhatsApp.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'pg7-cable-glands-metal-vs-plastic-for-bms-and-charger-enclosures',
    category: 'Connectors', tag: 'Connectors',
    title: 'PG7 Cable Glands: Metal or Plastic for BMS and Charger Enclosures',
    short: ['PG7 Cable Glands', 'Metal or plastic for your enclosure'],
    description: 'How to choose and fit PG7 cable glands in battery, BMS and charger enclosures: metal against plastic, cable size, hole size, sealing and strain relief. Live prices from Arambhika, Noida.',
    keywords: 'PG7 cable gland, metal vs plastic cable gland, cable gland enclosure battery, PG7 hole size, strain relief cable gland India',
    productsHeading: 'PG7 cable glands',
    intro: 'A cable gland lets a wire enter a box neatly. It grips the cable, seals the hole and stops the wire being pulled off its terminal.',
    body: `
      <h2>What the PG7 size means</h2>
      <p>PG is an older thread standard still used on many glands. A PG7 gland usually has a thread of about 12.5 mm and suits round cables of roughly 3 to 6.5 mm in diameter. Check the figures for the gland you buy, and measure your cable with a vernier caliper before choosing.</p>
      <h2>Metal or plastic</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Metal gland</th><th>Plastic gland</th></tr></thead>
        <tbody>
          <tr><td>Strength</td><td>Tougher, handles rough use</td><td>Adequate for normal use</td></tr>
          <tr><td>Insulation</td><td>Conducts, so keep it from live parts</td><td>Insulating by itself</td></tr>
          <tr><td>Weight and cost</td><td>Heavier and dearer</td><td>Light and economical</td></tr>
          <tr><td>Best for</td><td>Rugged chargers, outdoor boxes, high-vibration use</td><td>Small BMS and electronics boxes, high volumes</td></tr>
        </tbody>
      </table>
      <p>Our plastic gland is sold in larger minimum quantities for volume use, and the metal gland is sold singly.</p>
      <h2>Fitting it</h2>
      <ol>
        <li>Drill or punch a hole of the right diameter for the thread, with a clean, burr-free edge.</li>
        <li>Pass the cable through the gland body and nut before stripping, so you do not have to rethread.</li>
        <li>Fit the gland into the hole with its washer or O-ring on the outside, and tighten the locknut inside.</li>
        <li>Tighten the dome nut so the seal grips the cable without crushing it.</li>
        <li>Leave a little slack inside, and make sure a tug on the cable does not pull on the terminal.</li>
      </ol>
      <h2>Sealing</h2>
      <p>A gland only seals if the cable diameter suits it and the nut is tightened. For a box exposed to rain or dust, the enclosure and the gland both need a suitable ingress rating, so check the datasheets. A damp box can corrode terminals and the BMS.</p>
      <p>Glands: <a href="${p('PG-7 GLAND METAL')}">PG-7 metal</a> and <a href="${p('PG-7 GLAND Plastic')}">PG-7 plastic</a>. Use <a href="/blog/pvc-spiral-wrap-for-bms-harnesses-sizes-and-fitting.html">spiral wrap</a> to tidy the wires inside.</p>`,
    faq: [
      ['What cable fits a PG7 gland?', 'Usually round cable of about 3 to 6.5 mm. Measure yours and check the gland datasheet.'],
      ['Do I need a metal gland?', 'Not for a light-duty box. Choose metal for rough use or a rugged enclosure.'],
      ['Why leave slack inside?', 'So that a pull on the cable is taken by the gland and not by the terminal.'],
    ],
  }),
]
