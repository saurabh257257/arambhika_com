// Category posts, part A: nickel strip and cells (two posts for each category).
import { p, mk } from './blog-products-lib.mjs'

const NEW = { date: '2026-11-23', dateLabel: '23 November 2026', strict: true }

export const posts = [
  // ---- Nickel Strip Plated ----
  mk({
    ...NEW,
    slug: 'nickel-strip-metres-per-kg-length-and-weight-worked-out',
    category: 'Nickel Strip Plated,Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'How Many Metres in a Kilo? Nickel Strip Length and Weight Worked Out',
    short: ['Metres per Kilo of Nickel Strip', 'Length and weight for every common size'],
    description: 'Work out how many metres of nickel strip you get in 1 kg for 6, 8 and 10 mm widths and 0.15, 0.20 and 0.30 mm thickness, plated and pure. Live prices from Arambhika, Noida.',
    keywords: 'nickel strip metres per kg, nickel strip weight per metre, nickel strip length calculator, 8x0.15 nickel strip kg, nickel strip quantity battery pack',
    productsHeading: 'Strips used in the examples',
    intro: 'Nickel strip is sold by the kilo, but a pack is built in metres. Here is how to convert one into the other.',
    body: `
      <h2>The one-line formula</h2>
      <p>A strip that is 1 mm<sup>2</sup> in cross-section and 1 metre long has a volume of exactly 1 cm<sup>3</sup>. So the weight of one metre in grams is the cross-section in mm<sup>2</sup> times the density of the metal in g/cm<sup>3</sup>. Cross-section is width times thickness.</p>
      <p>Plated strip is a steel base with a nickel layer, so we use about 7.85 g/cm<sup>3</sup>. Pure nickel is about 8.9 g/cm<sup>3</sup>. These are handbook values, so treat the results as close estimates, not as a guarantee for a particular coil.</p>
      <h2>Metres in 1 kg</h2>
      <table class="blog-table">
        <thead><tr><th>Strip size (mm)</th><th>Cross-section (mm<sup>2</sup>)</th><th>Plated, about m per kg</th><th>Pure, about m per kg</th></tr></thead>
        <tbody>
          <tr><td>6 x 0.15</td><td>0.90</td><td>141</td><td>125</td></tr>
          <tr><td>8 x 0.15</td><td>1.20</td><td>106</td><td>94</td></tr>
          <tr><td>10 x 0.15</td><td>1.50</td><td>85</td><td>75</td></tr>
          <tr><td>10 x 0.20</td><td>2.00</td><td>64</td><td>56</td></tr>
          <tr><td>8 x 0.30</td><td>2.40</td><td>53</td><td>47</td></tr>
          <tr><td>10 x 0.30</td><td>3.00</td><td>42</td><td>38</td></tr>
        </tbody>
      </table>
      <h2>A worked example</h2>
      <p>You need 25 m of <a href="${p('Nickel Strip Plated 1P 8x0.15 mm')}">plated 1P 8x0.15 mm</a>. At about 106 m per kg that is roughly 0.24 kg. Our minimum order for these strips is 3 kg, which is about 318 m of that size, so a single order covers a lot of packs.</p>
      <h2>Using it to compare strips</h2>
      <p>Because pure nickel is denser, the same size weighs about 13 percent more per metre than plated. Compare strips by price per metre as well as price per kg, especially when you are choosing between sizes. The price per metre is the price per kg divided by the metres in a kilo.</p>
      <p>The 2P strips for 18650, 21700 and 32650 cells are formed shapes, so the table above does not apply to them. For those, count strips, not metres.</p>`,
    faq: [
      ['Are these weights exact?', 'No. They come from standard densities and the nominal size. Real coils vary slightly with tolerance and plating thickness, so use the figures for planning.'],
      ['Why does a thicker strip give fewer metres per kg?', 'Weight per metre grows with cross-section, so a strip with twice the cross-section gives about half the length from the same weight.'],
      ['How much do I have to order?', 'The minimum order is shown on each product page. For most strips it is 3 kg.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'storing-and-handling-nickel-strip-before-welding',
    category: 'Nickel Strip Plated', tag: 'Nickel Strip',
    title: 'Storing and Handling Nickel Strip So It Welds Well',
    short: ['Storing Nickel Strip', 'Keep it clean and dry before you weld'],
    description: 'How to store and handle nickel-plated strip: moisture, fingerprints, bends and cut edges, and a quick cleaning step before spot welding. Live prices from Arambhika, Noida.',
    keywords: 'store nickel strip, nickel strip oxidation, clean nickel strip before welding, nickel plated strip rust, spot welding surface preparation',
    productsHeading: 'Plated strips',
    intro: 'A weld is only as good as the surface it is made on. Most poor welds that look like machine problems start with a dirty or damp strip.',
    body: `
      <h2>Why storage matters</h2>
      <p>Plated strip is steel with a thin layer of nickel. The plating protects the face of the strip. The cut edges are bare steel, so a damp store room can leave light rust or a dull film there first. Spot welding goes through the surface, so films, oil and rust raise the contact resistance and make welds weaker and less repeatable.</p>
      <h2>Simple storage rules</h2>
      <ul>
        <li>Keep coils and cut lengths in a dry place, off the floor and away from walls that sweat in the monsoon.</li>
        <li>Leave the strip in its sealed bag until you need it, and reseal the bag after cutting. A few silica-gel sachets inside help.</li>
        <li>Store strip flat or on its own reel. Do not squeeze it under heavy items, which can kink it.</li>
        <li>Keep it away from acids, battery electrolyte, soldering flux and anything that gives off fumes.</li>
      </ul>
      <h2>Handling on the bench</h2>
      <ul>
        <li>Hold strip by the edges or wear clean gloves. Skin oil and sweat leave a film that shows up as inconsistent welds.</li>
        <li>Avoid sharp bends. Where you need a bend, make a smooth one, since a crease concentrates stress and thins the plating.</li>
        <li>Cut with sharp tools and deburr the edge. A burr can pierce insulation or touch the next cell.</li>
      </ul>
      <h2>A quick clean before welding</h2>
      <p>If a strip has been handled or stored for a while, wipe the weld faces with a lint-free cloth and isopropyl alcohol, let it dry, and weld straight away. Do not sand plated strip, because you would remove the plating you paid for.</p>
      <p>Look at the strip first. If you see orange rust spreading over the faces, or the plating is flaking, set that strip aside. Pure nickel does not have a steel base, so see our post on <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel strip</a> if you want a base that does not rust at the edges.</p>
      <p>Strips in this range include <a href="${p('Nickel Strip Plated 1P 10x0.15 mm')}">1P 10x0.15 mm</a> and <a href="${p('Nickel Strip Plated 2P(18650) 26x0.15 mm without slit')}">2P(18650) 26x0.15 mm</a>.</p>`,
    faq: [
      ['Can I clean nickel-plated strip with sandpaper?', 'No. Sanding removes the nickel plating. Wipe with isopropyl alcohol on a lint-free cloth instead.'],
      ['Does the strip expire?', 'It does not have a shelf life as such, but it can pick up moisture or rust if stored badly. Keep it dry and sealed.'],
      ['Why do cut edges rust first?', 'The plating covers the faces. Where the strip is cut, the steel base is exposed, so those edges are the first to show moisture damage.'],
    ],
  }),

  // ---- Nickel Strip Pure ----
  mk({
    ...NEW,
    slug: 'pure-vs-plated-nickel-strip-resistance-and-voltage-drop-worked-example',
    category: 'Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'Pure vs Plated Nickel Strip: Resistance and Voltage Drop, Worked Out',
    short: ['Pure vs Plated: The Numbers', 'Resistance, heat and voltage drop worked out'],
    description: 'Calculate the resistance of 8x0.15 and 10x0.30 mm strip in pure nickel and nickel-plated steel, and see what it means for heat and voltage drop at 20 A. Live prices from Arambhika, Noida.',
    keywords: 'pure nickel vs plated nickel strip resistance, nickel strip voltage drop, nickel strip heat I squared R, nickel strip resistivity, battery strip resistance',
    productsHeading: 'Pure nickel strips',
    intro: 'People say pure nickel conducts better than plated strip. Here is by how much, using one simple formula.',
    body: `
      <h2>The formula</h2>
      <p>Resistance of a strip is its resistivity times its length, divided by its cross-section: R = &rho; x L / A. Use metres for length and square metres for the area.</p>
      <p>Handbook resistivity at 20 &deg;C: pure nickel about 6.99 x 10<sup>-8</sup> ohm metre. Mild steel, the base of plated strip, is roughly 1.4 to 1.7 x 10<sup>-7</sup> ohm metre. We use 1.43 x 10<sup>-7</sup>. The plating is only a few microns thick, so the steel dominates the plated strip.</p>
      <h2>Example 1: 8 x 0.15 mm, 100 mm long</h2>
      <p>Cross-section is 1.2 mm<sup>2</sup>, or 1.2 x 10<sup>-6</sup> m<sup>2</sup>.</p>
      <ul>
        <li>Pure nickel: 6.99e-8 x 0.1 / 1.2e-6 = about 5.8 milliohm</li>
        <li>Plated steel: 1.43e-7 x 0.1 / 1.2e-6 = about 11.9 milliohm</li>
      </ul>
      <p>At 20 A the heat in the strip is I<sup>2</sup>R. That is about 2.3 W for pure nickel and 4.8 W for plated. The voltage drop is about 0.12 V against 0.24 V.</p>
      <h2>Example 2: 10 x 0.30 mm, same length</h2>
      <p>Cross-section is 3 mm<sup>2</sup>.</p>
      <ul>
        <li>Pure nickel: about 2.3 milliohm</li>
        <li>Plated steel: about 4.8 milliohm</li>
      </ul>
      <p>The same current now makes about 0.9 W and 1.9 W. Doubling the cross-section halves the resistance, and choosing pure nickel halves it again.</p>
      <h2>What to take from this</h2>
      <ul>
        <li>Pure nickel has about half the resistance of plated strip of the same size, so it runs cooler at the same current.</li>
        <li>You can reach the same resistance with plated strip by making it thicker or wider, at a different price per kg. Compare both options for your current.</li>
        <li>These figures are for the strip itself. The weld spots add their own resistance, and so does the cell terminal.</li>
      </ul>
      <p>Pure strips used in the examples: <a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">1P 8x0.15 mm</a> and <a href="${p('Nickel Strip Pure 1P 10x0.30 mm')}">1P 10x0.30 mm</a>. For a wider comparison see <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">Pure Nickel Strip for High-Current Packs</a>.</p>`,
    faq: [
      ['Are these resistance values exact?', 'They are calculated from handbook resistivities. Real strip varies with alloy, temperature and tolerance, so use them to compare options, not as specifications.'],
      ['Does thicker pure nickel always run cooler?', 'For the same width and length, yes: resistance falls as the cross-section rises. The weld joints still matter.'],
      ['Is it worth paying more for pure nickel?', 'It is worth it when current is high, space is tight or heat is a problem. For light loads, plated strip is usually enough.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'what-pure-nickel-strip-means-questions-to-ask-before-you-buy',
    category: 'Nickel Strip Pure', tag: 'Nickel Strip',
    title: 'What "99.9% Pure" Nickel Strip Means: Questions to Ask Before You Buy',
    short: ['Buying Pure Nickel Strip', 'What 99.9% means and what to ask'],
    description: 'What a pure nickel strip claim should cover: purity, thickness, width, flatness and temper. A short list of questions to ask any supplier before a bulk order. Live prices from Arambhika, Noida.',
    keywords: 'pure nickel strip 99.9, nickel strip purity, buy pure nickel strip India, nickel strip thickness tolerance, nickel strip specification',
    productsHeading: 'Pure nickel strips',
    intro: 'Pure nickel costs several times as much as plated strip, so it pays to know what you are buying.',
    body: `
      <h2>What the claim means</h2>
      <p>A strip described as 99.9 percent nickel is almost entirely nickel, with only trace elements. Plated strip is a different product: steel with a thin nickel coating. The two behave differently on the bench. Pure nickel has no steel core, so it has lower resistance and no rusting cut edge. Our <a href="/blog/pure-vs-plated-nickel-strip-resistance-and-voltage-drop-worked-example.html">worked example</a> shows how much lower.</p>
      <h2>Ten questions for any supplier</h2>
      <ol>
        <li>What is the stated purity, and can you share a material test or mill certificate for the batch?</li>
        <li>What are the exact width and thickness, and the tolerance on each?</li>
        <li>Is the strip flat, or does it have camber or curl along the length?</li>
        <li>Is it soft (annealed) or hard? Soft strip is easier to form around corners.</li>
        <li>How is it supplied: cut lengths, coil, or formed 2P shapes?</li>
        <li>How is it packed to keep moisture and fingerprints off the surface?</li>
        <li>Is the price per kg, and what is the minimum order?</li>
        <li>Is a GST invoice provided?</li>
        <li>For formed 2P strips, which cell format and centre distance is it for?</li>
        <li>Can I get a sample before a bulk order?</li>
      </ol>
      <h2>Check it yourself</h2>
      <ul>
        <li>Measure thickness with a micrometre at several points, not with a ruler.</li>
        <li>Weigh a metre and compare with the expected weight per metre. See our <a href="/blog/nickel-strip-metres-per-kg-length-and-weight-worked-out.html">metres per kilo table</a>.</li>
        <li>Make a few test welds on a scrap cell and pull-test them before committing to a large batch.</li>
      </ul>
      <p>Our pure nickel range includes <a href="${p('Nickel Strip Pure 1P 6x0.15 mm')}">1P 6x0.15 mm</a>, <a href="${p('Nickel Strip Pure 1P 10x0.20 mm')}">1P 10x0.20 mm</a> and formed strips such as <a href="${p('Nickel Strip Pure 2P(21700) 31x0.15 mm CD 22.5 with holder')}">2P(21700) 31x0.15 mm</a>. Send us your layout and quantity on WhatsApp and we will tell you which suits.</p>`,
    faq: [
      ['How can I tell pure nickel from plated strip?', 'The cut edge of plated strip shows a different metal inside. A magnet is not a reliable test, because nickel is magnetic too. A material test certificate, plus a weight and resistance check, is the proper proof.'],
      ['Why is pure strip priced so much higher?', 'It is solid nickel, a more expensive metal, while plated strip is mostly steel.'],
      ['Which thickness should I start with?', 'Choose by current. Our sizing guide shows worked examples, and 0.15 mm is a common starting point for spot-welded packs.'],
    ],
  }),

  // ---- Prismatic Cells ----
  mk({
    ...NEW,
    slug: 'prismatic-lfp-cells-by-kwh-from-100ah-to-314ah',
    category: 'Prismatic Cells', tag: 'Cells',
    title: 'Prismatic LFP Cells by kWh: From 100Ah to 314Ah',
    short: ['Prismatic LFP Cells by kWh', 'Energy per cell and how to compare cost'],
    description: 'Energy in kWh for 100, 150, 206, 230, 280 and 314Ah LFP prismatic cells, how big a pack each builds, and how to compare cells by cost per kWh. Live prices from Arambhika, Noida.',
    keywords: 'LFP prismatic cell kWh, 314Ah cell energy, 280Ah LFP cell, cost per kWh LFP cell, 3.2V prismatic cell capacity',
    productsHeading: 'Prismatic cells in the examples',
    intro: 'A cell is easier to compare once you turn amp-hours into kilowatt-hours. It takes one multiplication.',
    body: `
      <h2>Energy per cell</h2>
      <p>Energy in kWh is nominal voltage times capacity divided by 1000. An LFP cell is 3.2 V nominal.</p>
      <table class="blog-table">
        <thead><tr><th>Capacity</th><th>Energy per cell</th><th>16S pack (51.2 V)</th></tr></thead>
        <tbody>
          <tr><td>100 Ah</td><td>0.32 kWh</td><td>5.1 kWh</td></tr>
          <tr><td>150 Ah</td><td>0.48 kWh</td><td>7.7 kWh</td></tr>
          <tr><td>206 Ah</td><td>0.66 kWh</td><td>10.5 kWh</td></tr>
          <tr><td>230 Ah</td><td>0.74 kWh</td><td>11.8 kWh</td></tr>
          <tr><td>280 Ah</td><td>0.90 kWh</td><td>14.3 kWh</td></tr>
          <tr><td>314 Ah</td><td>1.00 kWh</td><td>16.1 kWh</td></tr>
        </tbody>
      </table>
      <p>A 16S pack uses 16 cells in series for 51.2 V nominal. One cell string of 314Ah cells gives about 16 kWh, which is a common size for home storage.</p>
      <h2>Compare cost per kWh</h2>
      <p>Divide the cell price by its energy in kWh. For example, if a 314Ah cell is priced at P rupees, the cost per kWh is P divided by 1.005. Use the live price on the product page, since prices change. Work it out for two or three capacities before you decide: a larger cell often costs less per kWh, but you need fewer of them, so check the minimum order as well.</p>
      <h2>Fewer big cells or more small cells</h2>
      <ul>
        <li>Big cells mean fewer joints, a simpler pack and fewer cells to balance.</li>
        <li>Small cells are easier to handle and let you size the pack in smaller steps.</li>
        <li>Each cell needs a busbar joint, so a 16S pack of 314Ah cells has far fewer connections than a 16S4P pack of 100Ah cells.</li>
      </ul>
      <p>Examples from our range: <a href="${p('TIANNENG 3.2V - 100Ah Prismatic Cell')}">100Ah</a>, <a href="${p('Ganfeng - 206Ah Laser Weld Prismatic Cell')}">206Ah</a>, <a href="${p('CALB 3.2V - 280Ah Prismatic Cell')}">280Ah</a> and <a href="${p('Highstar - 314Ah 3.2V Prismatic Cell')}">314Ah</a>. For a build with step-by-step wiring see <a href="/blog/314ah-lfp-prismatic-cell-16s-51v-home-energy-storage-build.html">Build a 51.2V 314Ah Storage Battery</a>.</p>`,
    faq: [
      ['How do I turn Ah into kWh?', 'Multiply nominal voltage by amp-hours and divide by 1000. For an LFP cell that is 3.2 x Ah / 1000.'],
      ['Is a bigger cell always better value?', 'Often it costs less per kWh, but check the minimum order and the size of the pack you need.'],
      ['Can I mix different capacities in one pack?', 'It is not recommended. Cells in the same pack should have the same capacity and come from the same batch.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'checking-lfp-prismatic-cells-on-arrival-voltage-swelling-matching',
    category: 'Prismatic Cells', tag: 'Cells',
    title: 'Checking LFP Prismatic Cells on Arrival: Voltage, Swelling and Matching',
    short: ['Checking LFP Cells on Arrival', 'A ten-minute inspection before you build'],
    description: 'A practical receiving check for LFP prismatic cells: packaging, swelling, terminals, resting voltage, matching and labelling, before you start a pack. Live prices from Arambhika, Noida.',
    keywords: 'check LFP cells on arrival, LFP cell inspection, prismatic cell swelling, match LFP cells voltage, new battery cells checklist',
    productsHeading: 'Prismatic cells',
    intro: 'Ten minutes with a multimeter when a box arrives saves hours of trouble later. Here is a short routine.',
    body: `
      <h2>Before you open the box</h2>
      <ul>
        <li>Check the outer packaging for crush damage, wet patches or burn marks.</li>
        <li>Count the cells against the invoice, and note the model and batch labels.</li>
        <li>Keep a photo of the box and labels in case of a claim.</li>
      </ul>
      <h2>Look at each cell</h2>
      <ul>
        <li><strong>Shape.</strong> Faces should be flat. A swollen or bulging cell is rejected, not repaired.</li>
        <li><strong>Case and vent.</strong> No dents, cracks, leaks or residue around the vent.</li>
        <li><strong>Terminals.</strong> Clean, flat and undamaged, with the studs or weld surfaces unmarked.</li>
        <li><strong>Labels.</strong> Same model, capacity and batch or date code on every cell.</li>
      </ul>
      <h2>Measure and record</h2>
      <ol>
        <li>Let the cells rest at room temperature, then measure each cell at the terminals with a meter you trust.</li>
        <li>LFP cells are usually shipped partly charged, so expect a resting voltage somewhere around 3.2 to 3.3 V. The datasheet or supplier will give the expected value.</li>
        <li>Write every voltage down. Cells in one pack should be close together. Builders usually top-balance cells to the same voltage before connecting them in parallel or series, as covered in <a href="/blog/top-balancing-lfp-cells-before-assembling-a-battery-pack.html">Top Balancing LFP Cells</a>.</li>
        <li>If you have an internal resistance meter, record that as well. A cell that reads very differently from its neighbours should be questioned.</li>
      </ol>
      <h2>If something is wrong</h2>
      <p>Do not charge a damaged or very low cell. Photograph it, stop, and contact us the same day with the batch details so it can be sorted out. A fault found at the receiving stage is far easier to resolve than one found after the pack is welded together.</p>
      <p>See also our <a href="/blog/buying-lfp-prismatic-cells-india-checklist-matching-grade-testing.html">checklist for buying LFP cells</a>. Cells in this range include <a href="${p('GreatPower 3.2V - 230Ah Prismatic Cell')}">GreatPower 230Ah</a> and <a href="${p('Ganfeng - 314Ah Laser Weld Prismatic Cell')}">Ganfeng 314Ah</a>.</p>`,
    faq: [
      ['What voltage should new LFP cells read?', 'They are normally shipped partly charged, so around 3.2 to 3.3 V is typical. Check your cell datasheet for the exact range.'],
      ['Should I charge cells before building?', 'Top-balance cells to the same voltage before you join them, following the cell datasheet and a charger suited to LFP.'],
      ['What should I do with a swollen cell?', 'Do not use it. Keep it away from heat and other cells and send us photos and the batch details.'],
    ],
  }),

  // ---- NMC Cylindrical Cells ----
  mk({
    ...NEW,
    slug: 'nmc-18650-21700-energy-cells-vs-power-cells-how-to-read-the-spec',
    category: 'NMC Cylindrical Cells', tag: 'Cells',
    title: 'Energy Cells vs Power Cells: How to Read an NMC 18650 or 21700 Spec',
    short: ['Energy vs Power NMC Cells', 'What the capacity and current ratings tell you'],
    description: 'How to read an NMC 18650 or 21700 datasheet: capacity, continuous discharge, internal resistance and cycle life, and how to pick between energy and power cells. Live prices from Arambhika, Noida.',
    keywords: 'NMC 18650 datasheet, energy cell vs power cell, 18650 discharge current, 21700 4500mAh, EV grade 18650 cell',
    productsHeading: 'NMC cylindrical cells',
    intro: 'Two 18650 cells can look the same and behave very differently. The numbers on the datasheet tell you which is which.',
    body: `
      <h2>The five numbers that matter</h2>
      <table class="blog-table">
        <thead><tr><th>Spec</th><th>What it tells you</th></tr></thead>
        <tbody>
          <tr><td>Capacity (mAh)</td><td>How much energy is stored. More mAh means longer runtime.</td></tr>
          <tr><td>Max continuous discharge (A)</td><td>The current the cell can supply for long periods without overheating.</td></tr>
          <tr><td>Internal resistance (milliohm)</td><td>Lower is better. It sets heat and voltage sag under load.</td></tr>
          <tr><td>Cycle life</td><td>How many full cycles to a stated capacity, at stated currents and temperatures.</td></tr>
          <tr><td>Charge current</td><td>The safe standard charge rate. Fast charging needs a cell rated for it.</td></tr>
        </tbody>
      </table>
      <h2>Energy cells and power cells</h2>
      <p>An energy cell is built to store as much as possible, for slow, steady loads such as a power bank, a light or a battery for a laptop-style drain. A power cell is built to deliver high current, so it usually has a lower capacity for the same size but handles tools or e-bike bursts with less heat.</p>
      <h2>Choosing for your load</h2>
      <ol>
        <li>Work out the peak current of your pack, then divide by the number of cells in parallel. That is the current per cell.</li>
        <li>Compare it with the maximum continuous discharge rating. Stay comfortably below it.</li>
        <li>Within the cells that pass, pick the capacity that gives the runtime you want.</li>
      </ol>
      <p>For example, a pack that peaks at 40 A with 4 cells in parallel asks 10 A from each cell. A cell rated for a lower continuous current will get hot there.</p>
      <h2>Where to find the numbers</h2>
      <p>Always read the manufacturer datasheet for the exact model and batch, not just the label. The ratings differ by maker, by model and by test conditions. Our range includes <a href="${p('NORDA NMC CELL 18650 2600 mAh EV GRADE')}">NORDA 18650 2600 mAh EV grade</a>, <a href="${p('NORDA NMC CELL 21700 4500 mAh')}">NORDA 21700 4500 mAh</a> and <a href="${p('HONGLI 18650 NMC CELL 1800 mAh')}">HONGLI 18650 1800 mAh</a>. Ask us for the datasheet of the model you are considering.</p>
      <p>For a size comparison see <a href="/blog/18650-vs-21700-nmc-cells-which-for-your-battery-pack.html">18650 vs 21700</a>.</p>`,
    faq: [
      ['Is a higher mAh cell always better?', 'Only if the load is light. High-capacity cells often have a lower maximum current, so check the discharge rating first.'],
      ['What does EV grade mean?', 'It is a supplier term for a cell intended for e-mobility use. Ask for the datasheet to see the actual ratings.'],
      ['Can I mix cells from different makers?', 'No. Keep one model and one batch in a pack, so capacity and resistance are matched.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'how-many-18650-21700-cells-for-your-pack-cell-count-calculator',
    category: 'NMC Cylindrical Cells', tag: 'Cells',
    title: 'How Many 18650 or 21700 Cells Do You Need? A Cell Count Calculator',
    short: ['Cell Count for Your Pack', 'Series, parallel and total cells, worked out'],
    description: 'Work out the series and parallel count for your voltage and capacity with 18650 or 21700 NMC cells, plus the energy you get. Two worked examples. Live prices from Arambhika, Noida.',
    keywords: 'how many 18650 cells for 48V, 21700 pack calculator, 13S pack cells, battery pack cell count, series parallel calculator NMC',
    productsHeading: 'Cells used in the examples',
    intro: 'Give yourself a target voltage and capacity, and three lines of arithmetic tell you how many cells to buy.',
    body: `
      <h2>The three steps</h2>
      <ol>
        <li><strong>Series count (S)</strong> = target voltage divided by 3.6 V, the nominal voltage of an NMC cell. Round to the nearest whole number.</li>
        <li><strong>Parallel count (P)</strong> = target capacity in Ah divided by the cell capacity in Ah. Round up.</li>
        <li><strong>Total cells</strong> = S times P. Energy in Wh = S x 3.6 x P x cell Ah.</li>
      </ol>
      <h2>Example 1: a 48 V, 20 Ah pack from 21700 cells</h2>
      <p>With <a href="${p('LITHIUM-ION CELL 4500 mAh DMEGC 21700')}">4500 mAh 21700 cells</a>:</p>
      <ul>
        <li>S = 48 / 3.6 = 13.3, so use 13S (46.8 V nominal).</li>
        <li>P = 20 / 4.5 = 4.4, so use 5P, which gives 22.5 Ah.</li>
        <li>Total = 13 x 5 = 65 cells. Energy = 46.8 V x 22.5 Ah = about 1053 Wh.</li>
      </ul>
      <h2>Example 2: a 36 V, 10 Ah pack from 18650 cells</h2>
      <p>With <a href="${p('LITHIUM-ION CELL 2600 mAh DMEGC 18650')}">2600 mAh 18650 cells</a>:</p>
      <ul>
        <li>S = 36 / 3.6 = 10, so 10S.</li>
        <li>P = 10 / 2.6 = 3.8, so 4P, which gives 10.4 Ah.</li>
        <li>Total = 10 x 4 = 40 cells. Energy = 36 V x 10.4 Ah = about 374 Wh.</li>
      </ul>
      <h2>Then check three things</h2>
      <ul>
        <li><strong>Current.</strong> Peak pack current divided by P must stay below the cell's continuous rating. See <a href="/blog/nmc-18650-21700-energy-cells-vs-power-cells-how-to-read-the-spec.html">how to read the spec</a>.</li>
        <li><strong>Full-charge voltage.</strong> S x 4.2 V is the top voltage your charger and BMS must handle.</li>
        <li><strong>Buy spares.</strong> Order a few extra cells for test welds and for any cell that fails your receiving check.</li>
      </ul>
      <p>For a full build see <a href="/blog/build-13s-nmc-48v-battery-pack-21700-cells-step-by-step.html">Build a 13S 48V 21700 Pack</a>, and use a BMS with the matching series count (see <a href="/blog/lfp-vs-nmc-bms-series-count-12v-48v-72v-pack-guide.html">this guide</a>).</p>`,
    faq: [
      ['Why 3.6 V per cell?', 'It is the nominal voltage used for NMC cells. Some datasheets use 3.7 V, which changes the numbers slightly.'],
      ['Should I round up or down for the series count?', 'To the nearest whole number, then check the full-charge voltage (S x 4.2 V) against your motor controller and charger.'],
      ['Do I need extra cells?', 'Order a few more than the total, for test welds and rejects at the receiving check.'],
    ],
  }),

  // ---- LFP Cylindrical Cells ----
  mk({
    ...NEW,
    slug: 'lfp-32140-15ah-pack-layouts-12v-24v-48v',
    category: 'LFP Cylindrical Cells', tag: 'Cells',
    title: '32140 LFP Cell Pack Layouts: 12.8V, 25.6V and 51.2V from One Cell',
    short: ['32140 LFP Pack Layouts', '12.8V, 25.6V and 51.2V from one cell'],
    description: 'Series and parallel layouts for 3.2V 15Ah 32140 LFP cells: how many cells for 12.8V, 25.6V and 51.2V packs, the energy of each and what BMS series count to use. Live prices from Arambhika, Noida.',
    keywords: '32140 LFP pack layout, 12.8V LFP pack cells, 51.2V 32140 pack, 4S 8S 16S LFP, 15Ah LFP cell series parallel',
    productsHeading: '32140 LFP cells',
    intro: 'The 32140 LFP cell is 3.2 V and 15 Ah. Three layouts cover most 12 V, 24 V and 48 V needs.',
    body: `
      <h2>Voltage from series, capacity from parallel</h2>
      <p>Each cell is 3.2 V nominal and 15 Ah. Cells in series add voltage. Cells in parallel add capacity. LFP cells are charged to 3.65 V each.</p>
      <table class="blog-table">
        <thead><tr><th>Layout</th><th>Nominal voltage</th><th>Capacity</th><th>Energy</th><th>Cells</th><th>BMS</th></tr></thead>
        <tbody>
          <tr><td>4S4P</td><td>12.8 V</td><td>60 Ah</td><td>768 Wh</td><td>16</td><td>4S LFP</td></tr>
          <tr><td>8S4P</td><td>25.6 V</td><td>60 Ah</td><td>1536 Wh</td><td>32</td><td>8S LFP</td></tr>
          <tr><td>16S2P</td><td>51.2 V</td><td>30 Ah</td><td>1536 Wh</td><td>32</td><td>16S LFP</td></tr>
          <tr><td>16S4P</td><td>51.2 V</td><td>60 Ah</td><td>3072 Wh</td><td>64</td><td>16S LFP</td></tr>
        </tbody>
      </table>
      <p>The 8S4P and 16S2P packs hold the same energy in different voltages. Pick the voltage your inverter, charger or motor controller needs, then size the parallel count for capacity.</p>
      <h2>Current limits</h2>
      <p>The datasheet of one model in our range, the <a href="${p('CBAK LFP CELL 32140 15 Ah EV')}">CBAK 32140 15 Ah</a>, gives a maximum charge of 1C (15 A) and a maximum discharge of 2C (45 A) per cell. With 4 cells in parallel that is 60 A charge and 180 A discharge at the pack level, but stay well below it for a long life. Always confirm the figures for the exact cell you buy.</p>
      <h2>Building it</h2>
      <ul>
        <li>Use cell holders to keep the cylinders aligned, and a spot-welded strip of the right size. See <a href="/blog/nickel-strip-32650-2p-46-5-47-49-5mm-width-and-thickness-guide.html">nickel strip for 32650 and 32140 cells</a>.</li>
        <li>Choose the BMS for the series count in the table, rated above your peak current.</li>
        <li>Top-balance the cells before you join them.</li>
      </ul>
      <p>Cells in this range include <a href="${p('JSK LFP CELL 32140 15 Ah ESS AGRADE')}">JSK 32140 ESS A grade</a> and <a href="${p('MOCEAN LFP CELL 3.2V 15AH 32140')}">MOCEAN 32140</a>. See also <a href="/blog/build-12v-60ah-lfp-pack-32140-cells-4s4p-step-by-step.html">Build a 12.8V 60Ah 32140 Pack</a>.</p>`,
    faq: [
      ['How many 32140 cells make a 12V pack?', 'Four in series (4S) gives 12.8 V nominal. Add parallel groups for more capacity, for example 4S4P for 60 Ah.'],
      ['What BMS do I need?', 'One with the same series count as your pack and an LFP charge voltage of 3.65 V per cell, rated above your peak current.'],
      ['Can I use a lead-acid charger?', 'Not without checking it. LFP needs its own charge profile and a BMS to protect each cell.'],
    ],
  }),

  mk({
    ...NEW,
    slug: 'lfp-32140-cells-ess-grade-vs-ev-grade-what-the-label-means',
    category: 'LFP Cylindrical Cells', tag: 'Cells',
    title: 'ESS Grade or EV Grade? Choosing 32140 LFP Cells for Your Use',
    short: ['ESS vs EV Grade 32140 Cells', 'Match the label to what your pack does'],
    description: 'What ESS A grade and EV labels on 32140 LFP cells usually mean, how to match a cell to storage or mobility use, and what to ask for in the datasheet. Live prices from Arambhika, Noida.',
    keywords: 'ESS grade LFP cell, EV grade LFP cell, 32140 LFP datasheet, A grade LFP cell, LFP cell for solar storage',
    productsHeading: '32140 LFP cells',
    intro: 'Cell labels such as "ESS A grade" or "EV" describe the intended use. They are not a promise on their own, so here is how to read them.',
    body: `
      <h2>What the labels usually say</h2>
      <ul>
        <li><strong>ESS</strong> stands for energy storage system. Stationary packs for solar, home backup and telecom are charged and discharged slowly, so the cell is chosen for capacity, cycle life and consistency.</li>
        <li><strong>EV</strong> points to mobility use, such as e-bikes and light vehicles. These packs see higher current and vibration, so the cell's discharge rating matters more.</li>
        <li><strong>A grade</strong> is a supplier's way of saying the cell passed grading for capacity and resistance. Different suppliers grade differently, so it is a starting point for questions, not a standard.</li>
      </ul>
      <h2>Match the cell to the job</h2>
      <table class="blog-table">
        <thead><tr><th>Your pack</th><th>What to prioritise</th></tr></thead>
        <tbody>
          <tr><td>Solar or inverter backup</td><td>Capacity match, cycle life, low self-discharge</td></tr>
          <tr><td>E-bike or light EV</td><td>Continuous and peak discharge current, resistance, cell strength</td></tr>
          <tr><td>Telecom or UPS</td><td>Reliability and a tight capacity match across cells</td></tr>
        </tbody>
      </table>
      <h2>Ask for the datasheet</h2>
      <p>Before a bulk order, ask for the datasheet of the exact model and check:</p>
      <ol>
        <li>Nominal capacity and voltage (3.2 V, 15 Ah for most 32140 cells).</li>
        <li>Charge and discharge limits in amps.</li>
        <li>Cycle life, and the conditions it was tested at.</li>
        <li>Size and weight, so your holders and enclosure fit.</li>
        <li>Internal resistance, and whether cells in a batch are matched.</li>
      </ol>
      <p>For example, the <a href="${p('LFP CELL 3.2V 15AH CNAE 32140 ESS A GRADE')}">CNAE 32140 ESS A grade</a> is described for energy storage, and the <a href="${p('CBAK LFP CELL 32140 15 Ah EV')}">CBAK 32140 EV</a> is listed for e-bikes, light EVs and storage. If you are unsure which to use, send us your load and pack voltage on WhatsApp.</p>
      <p>Layouts for these cells are in our <a href="/blog/lfp-32140-15ah-pack-layouts-12v-24v-48v.html">32140 pack layouts</a> post.</p>`,
    faq: [
      ['Is an EV grade cell better than an ESS cell?', 'Neither is better in general. They are chosen for different jobs, so match the datasheet to your load.'],
      ['What does A grade guarantee?', 'On its own, not much. Ask the supplier what test the grade is based on and for the datasheet.'],
      ['Can I use ESS cells in an e-bike?', 'Only if the continuous and peak discharge ratings cover your load. Check the datasheet.'],
    ],
  }),
]
