// Blog content: one post per material sold on the store. Plain strings of HTML, rendered by build-blog.mjs.
// Keep claims general and checkable; prices and stock are shown live from the store, never typed here.

const p = (name) => `/?product=${encodeURIComponent(name)}#catalog`
const date = '2026-10-03'
const dateLabel = '3 October 2026'

export const posts = [
  {
    slug: 'nickel-plated-strip-ev-battery-packs-india',
    featured: true,
    category: 'Nickel Strip Plated',
    tag: 'Nickel Strip Plated',
    title: 'Nickel-Plated Strip for Battery Packs in India: Sizes, Uses & Buying Guide',
    metaTitle: 'Nickel-Plated Strip for Battery Packs in India: Sizes & Buying Guide | Arambhika',
    description: 'Buying nickel-plated strip for 18650, 21700 or 32650 battery packs in India? See sizes, where it fits (e-bikes, inverters, solar lights), welding tips for humid weather and live prices from Arambhika, Noida.',
    keywords: 'nickel plated strip India, nickel plated steel strip price per kg, 18650 nickel strip India, battery spot welding strip, e-bike battery pack strip, 2P nickel strip, nickel strip manufacturer Noida',
    teaser: 'Where plated strip makes sense, how to read 1P and 2P sizes, and how to weld and store it in Indian weather.',
    productsHeading: 'Nickel-plated strips you can order today',
    ctaHeading: 'Need plated strip for your next batch?',
    waText: 'Hi Arambhika, I read your nickel-plated strip guide and need a quote.',
    heroImage: '/assets/products/nickel-plated/npl_2p_31x.15mm_1.jpg',
    imageAlt: 'Nickel-plated 2P H-type strip for 21700 battery packs',
    date, dateLabel, readTime: 6,
    intro: 'If you assemble lithium battery packs in India, you will buy nickel strip every week. Nickel-plated steel strip is the workhorse for cost-sensitive packs: e-cycles, electric scooters, home inverter conversions, solar street lights and power banks. This guide explains what you are buying, how to pick the size, and how to get clean welds even in monsoon humidity.',
    body: `
      <h2>What is nickel-plated strip?</h2>
      <p>It is a thin steel strip with a nickel coating on both faces. The steel core gives strength and keeps the price low. The nickel layer gives a surface that spot-welds well to the cell terminal and resists rust. Plating thickness varies by grade, so always confirm the plating spec for the size you need before a large order.</p>

      <h2>Where Indian pack makers use it</h2>
      <ul>
        <li><strong>Electric cycles and e-scooters:</strong> 36 V and 48 V packs built from 18650 or 21700 cells, where budget matters and current per strip is moderate.</li>
        <li><strong>Inverter and UPS lithium conversions:</strong> homes replacing lead-acid with small lithium banks to ride out power cuts.</li>
        <li><strong>Solar street lights and garden lights:</strong> low-current packs that live outdoors for years.</li>
        <li><strong>Power banks, portable tools and LED lanterns:</strong> a large market in Delhi NCR, Pune and Chennai.</li>
        <li><strong>Prototype and R&amp;D packs:</strong> start-ups proving a design before moving to pure nickel.</li>
      </ul>

      <h2>How to read the sizes</h2>
      <p>Our listings follow a simple pattern. <strong>1P</strong> is a single plain strip, for example <a href="${p('Nickel Strip Plated 1P 8x0.15 mm')}">Nickel Strip Plated 1P 8x0.15 mm</a>. <strong>2P</strong> is a pre-cut strip that joins two cells in parallel, for example <a href="${p('Nickel Strip Plated 2P(21700) 31x0.15 mm CD 22.5')}">2P (21700) 31x0.15 mm</a>. The number in brackets is the cell format, and <strong>CD</strong> is the centre-to-centre distance between the two cells. Some 2P variants add a slit, a holder cut-out or a fuse-type profile.</p>
      <table class="blog-table">
        <thead><tr><th>Strip</th><th>Cross-section</th><th>Typical use</th></tr></thead>
        <tbody>
          <tr><td>8 x 0.15 mm</td><td>1.2 mm&sup2;</td><td>Low-current cell-to-cell links, small packs</td></tr>
          <tr><td>10 x 0.15 mm</td><td>1.5 mm&sup2;</td><td>Light e-cycle and lantern packs</td></tr>
          <tr><td>10 x 0.30 mm</td><td>3.0 mm&sup2;</td><td>Higher-current series links and main runs</td></tr>
        </tbody>
      </table>
      <p>Cross-section is simply width times thickness. A bigger cross-section carries more current with less heating, so for a higher-current pack use a thicker strip, several strips in parallel, or switch to <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel strip</a>. Our <a href="/18650-21700-32650-nickel-strip-sizing-guide.html">18650 vs 21700 vs 32650 sizing guide</a> goes deeper.</p>

      <h2>Plated or pure: a quick rule</h2>
      <p>Choose plated when cost per pack matters and the discharge current is modest. Choose pure nickel when the pack runs hot, discharges hard, or has to last many years. Our <a href="/nickel-plated-vs-pure-nickel-strip.html">plated vs pure comparison</a> covers the trade-offs.</p>

      <h2>Welding and storage tips for Indian weather</h2>
      <ol>
        <li><strong>Keep it dry.</strong> During the monsoon, store strip in sealed bags with silica gel. Surface oxidation is the most common cause of weak, inconsistent welds.</li>
        <li><strong>Wipe before welding.</strong> A clean, dry surface lets the weld nugget form evenly.</li>
        <li><strong>Test your settings.</strong> Spot-weld a sample strip, pull it by hand and check that the strip tears, not the nugget. Adjust energy for each thickness.</li>
        <li><strong>Mind the heat.</strong> Do not dwell on one cell terminal. Overheating damages the cell.</li>
      </ol>
      <p class="blog-note">This is general guidance. Always validate strip size, welding settings and pack safety against your own design and the standards that apply to your product.</p>

      <h2>Buying from Arambhika, Noida</h2>
      <p>We supply nickel strip to pack makers across India from Noida in Uttar Pradesh, with GST invoice. Minimum quantity and live price are shown on every product, and you can build a quote and send it on WhatsApp in one tap. Prefer to see everything on paper? Download the <a href="/catalog.html?autoprint=1">PDF catalogue</a>.</p>`,
    faq: [
      ['Can I use nickel-plated strip for a 48 V e-bike battery?', 'Often yes, if the current per strip stays within a safe limit. For heavy-current packs use a thicker strip, more strips in parallel, or pure nickel. Share your pack current with us and we will suggest a size.'],
      ['What does 2P and CD mean in the product names?', '2P means one strip joins two cells in parallel. CD is the centre-to-centre distance between those two cells. Pick the CD that matches your cell holder or pack layout.'],
      ['What is the minimum order quantity?', 'It is shown on each product page. For example, the 1P 8x0.15 mm strip lists a minimum of 4 kg. You can add it to your quote and confirm on WhatsApp.'],
      ['Do you deliver across India?', 'Yes. We dispatch from Noida to pack makers in Delhi NCR, Pune, Bengaluru, Chennai, Hyderabad and other cities. Tell us your city when you request a quote.'],
      ['How should I store nickel strip during the monsoon?', 'Keep it sealed in a dry bag with silica gel and avoid opening coils in humid air. Dry strip welds more consistently.'],
    ],
  },

  {
    slug: 'pure-nickel-strip-lithium-battery-packs-india',
    featured: true,
    category: 'Nickel Strip Pure',
    tag: 'Nickel Strip Pure',
    title: 'Pure Nickel Strip for Lithium Battery Packs: High-Current Uses in India',
    metaTitle: 'Pure Nickel Strip for Lithium Battery Packs in India | 2P, Zig-Zag, 18650/21700/32650 | Arambhika',
    description: 'Why Indian EV, e-scooter, drone and solar storage builders choose pure nickel strip: lower resistance, better corrosion resistance and cleaner welds. Sizes, zig-zag and 2P options with live prices.',
    keywords: 'pure nickel strip India, pure nickel strip for 18650, nickel strip 99.5, 21700 nickel strip, 32650 LFP nickel strip, high current battery pack strip, EV battery nickel strip supplier India',
    teaser: 'Lower resistance, cleaner welds and rust-free life: when pure nickel is worth the extra cost for Indian conditions.',
    productsHeading: 'Pure nickel strips in our store',
    ctaHeading: 'Building a high-current pack?',
    waText: 'Hi Arambhika, I read your pure nickel strip guide and need a quote.',
    heroImage: '/assets/products/nickel-pure/np_2p_46.5x.15mm_1.jpg',
    imageAlt: 'Pure nickel 2P H-type strip for 32650 battery packs',
    date, dateLabel, readTime: 6,
    intro: 'Pure nickel strip costs more than plated steel, and for the right pack it pays for itself. Electric two-wheelers, drone and power-tool packs, and solar home storage all push high current through the interconnects, and heat at those joints is what shortens pack life. Here is when pure nickel is the better call, and how to choose the format.',
    body: `
      <h2>What makes pure nickel different?</h2>
      <p>Pure nickel strip is nickel all the way through, with no steel core. That gives it lower electrical resistance than a plated steel strip of the same size, so less energy is lost as heat in the strip. It also stays bright and rust-free, because there is no steel underneath to corrode if the surface is scratched. It is softer and welds cleanly and consistently. Confirm the nickel grade with any supplier before a production order.</p>

      <h2>Why it matters in Indian conditions</h2>
      <ul>
        <li><strong>Heat:</strong> Packs in Delhi, Nagpur or Chennai summers start from a high ambient temperature. Lower strip resistance leaves more thermal headroom.</li>
        <li><strong>Humidity and coastal air:</strong> Mumbai, Kochi and Kolkata packs face salt and moisture. Pure nickel does not rust-stain.</li>
        <li><strong>Safety expectations:</strong> Norms for electric two-wheelers, such as AIS-156 for L-category vehicles, raise the bar on thermal behaviour. Better interconnects help, but compliance depends on the whole pack design and testing.</li>
        <li><strong>Long service life:</strong> Fleet, delivery and rental e-bikes run daily. A strip that stays low-resistance for years lowers warranty claims.</li>
      </ul>

      <h2>Where Indian builders use pure nickel</h2>
      <ul>
        <li>Electric scooters and motorcycles with high peak-current packs</li>
        <li>E-autos and delivery two-wheelers with daily deep cycling</li>
        <li>Drone, power-tool and high-drain 21700 packs</li>
        <li>LFP cylindrical packs built from 32650 or 33140 cells for solar and home storage</li>
        <li>Medical, instrument and telecom backup packs where reliability comes first</li>
      </ul>

      <h2>Formats and sizes</h2>
      <p>Our store lists single strips and pre-cut 2P strips in several shapes:</p>
      <table class="blog-table">
        <thead><tr><th>Format</th><th>Example</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>1P plain strip</td><td><a href="${p('Nickel Strip Pure 1P 8x0.15 mm')}">1P 8x0.15 mm</a>, <a href="${p('Nickel Strip Pure 1P 6X0.15mm')}">1P 6x0.15 mm</a></td><td>Cell-to-cell links, custom layouts</td></tr>
          <tr><td>2P for 18650 / 21700</td><td>2P (21700) 31x0.15 mm, with or without holder</td><td>Two cells in parallel, fast assembly</td></tr>
          <tr><td>2P for 32650</td><td>2P (32650) 46.5x0.15 mm, with holder or fuse type</td><td>LFP cylindrical packs</td></tr>
          <tr><td>Zig-zag</td><td>Zig-zag (18650) and 2P (33140) zig-zag</td><td>Flexible layouts that absorb cell movement</td></tr>
        </tbody>
      </table>
      <p>Thickness options include 0.15, 0.20 and 0.30 mm. Thicker strip carries more current, but it needs more weld energy, so test on your machine. Not sure about width? Read our <a href="/18650-21700-32650-nickel-strip-sizing-guide.html">strip sizing guide</a>.</p>

      <h2>Pure or plated: how to decide</h2>
      <table class="blog-table">
        <thead><tr><th></th><th>Plated steel</th><th>Pure nickel</th></tr></thead>
        <tbody>
          <tr><td>Price</td><td>Lower</td><td>Higher</td></tr>
          <tr><td>Resistance</td><td>Higher</td><td>Lower</td></tr>
          <tr><td>Corrosion if scratched</td><td>Steel can rust</td><td>Stays clean</td></tr>
          <tr><td>Best for</td><td>Low and medium current, budget packs</td><td>High current, hot climates, long life</td></tr>
        </tbody>
      </table>
      <p>If you are still deciding, read the <a href="/nickel-plated-vs-pure-nickel-strip.html">plated vs pure guide</a> or see our <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">nickel-plated strip blog</a>.</p>
      <p class="blog-note">General guidance only. Validate strip size, welding settings and pack safety against your own design and the standards that apply to your product.</p>`,
    faq: [
      ['Is pure nickel strip worth the extra cost?', 'For high-current, hot-climate or long-life packs, usually yes. The lower resistance cuts heat at the joints and the strip stays clean. For small low-current packs, plated strip is often enough.'],
      ['Which pure nickel strip fits 21700 cells?', 'Use a 2P strip made for the 21700 format, or a 1P strip in the width your layout needs. The listings show width, thickness and centre distance so you can match your holder.'],
      ['What are zig-zag nickel strips used for?', 'Zig-zag strips flex slightly, which helps absorb cell movement and thermal expansion. We list zig-zag options for 18650 and 33140 cells.'],
      ['Can I weld pure nickel with my existing spot welder?', 'Most pack makers do. Pure nickel is softer than plated steel, so start with lower energy and test pull strength on a sample before production.'],
      ['Do you supply pure nickel strip across India?', 'Yes, from Noida with GST invoice. Send your quantity and city on WhatsApp and we will quote with dispatch time.'],
    ],
  },

  {
    slug: 'copper-busbar-battery-ess-india',
    featured: true,
    category: 'Copper Bus Bar',
    tag: 'Copper Bus Bar',
    title: 'Tin-Coated Copper Busbars for EV & ESS Battery Packs in India',
    metaTitle: 'Tin-Coated Copper Busbar for EV & ESS Battery Packs in India | Arambhika',
    description: 'Choosing a copper busbar for LFP prismatic cell packs, solar ESS and inverter battery banks in India? Learn why tin coating helps, how to size 20 x 2 mm bars, and see lengths available from Arambhika, Noida.',
    keywords: 'copper busbar India, tin coated copper busbar, battery busbar prismatic cell, copper bus bar 20x2mm, LFP battery busbar, ESS busbar India, inverter battery busbar, copper busbar manufacturer Noida',
    teaser: 'Why tin-coated copper suits prismatic LFP and ESS packs, plus a simple way to size a 20 x 2 mm busbar.',
    productsHeading: 'Copper busbars in our store',
    ctaHeading: 'Need busbars in bulk or a custom length?',
    waText: 'Hi Arambhika, I read your copper busbar guide and need a quote.',
    heroImage: '/assets/products/copper-bus-bars/Copper_Bus_Bar_2mm.jpg',
    imageAlt: 'Tin-coated copper busbar 20 x 2 mm for prismatic battery cells',
    date, dateLabel, readTime: 5,
    intro: 'India is moving fast to lithium for solar storage, telecom backup, inverter banks and electric three-wheelers. Many of these packs use large prismatic LFP cells, and those cells are joined with bolted copper busbars, not welded nickel strip. This guide explains why copper, why tin coating, and how to size the bar for your current.',
    body: `
      <h2>Why copper for busbars?</h2>
      <p>Among common metals, copper conducts best after silver. For the same cross-section a copper bar runs cooler than aluminium, which matters when a pack carries tens of amps for hours. Large prismatic cells, such as the 100 Ah LFP cells common in Indian ESS and e-rickshaw packs, are connected through bolted terminals, and a flat copper bar is the standard link.</p>

      <h2>Why tin coating?</h2>
      <p>Bare copper tarnishes over time, and a tarnished joint has higher resistance and heats up. A tin coating protects the surface, helps in humid and coastal air, and keeps bolted joints stable. Our <a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">Universal copper busbars</a> are 20 mm wide and 2 mm thick, tin coated, in four lengths.</p>

      <h2>Where Indian builders use them</h2>
      <ul>
        <li><strong>Solar and home energy storage:</strong> LFP rack and wall-mount batteries paired with hybrid inverters.</li>
        <li><strong>Inverter battery banks:</strong> lithium replacements for tubular lead-acid batteries in homes and shops.</li>
        <li><strong>Telecom and data-centre backup:</strong> compact lithium banks replacing lead-acid in towers and server rooms.</li>
        <li><strong>E-rickshaws and electric three-wheelers:</strong> prismatic LFP packs with high daily cycling.</li>
        <li><strong>Battery swapping and fleet packs:</strong> repeatable assemblies that need uniform busbars.</li>
      </ul>

      <h2>Choosing the length</h2>
      <p>Pick the length by the distance between the two cell terminals you are joining, with a little allowance for the bolt holes. We stock four lengths in the same 20 x 2 mm section: 55, 60, 68 and 82 mm. Measure your terminal pitch before you order, or send us a drawing for a custom size.</p>
      <table class="blog-table">
        <thead><tr><th>Size</th><th>Cross-section</th><th>Listing</th></tr></thead>
        <tbody>
          <tr><td>55 x 20 x 2 mm</td><td>40 mm&sup2;</td><td><a href="${p('COPPER BUS BAR Universal (55x20x2mm) - Tin Coated')}">View product</a></td></tr>
          <tr><td>60 x 20 x 2 mm</td><td>40 mm&sup2;</td><td><a href="${p('COPPER BUS BAR Universal (60x20x2mm) - Tin Coated')}">View product</a></td></tr>
          <tr><td>68 x 20 x 2 mm</td><td>40 mm&sup2;</td><td><a href="${p('COPPER BUS BAR Universal (68x20x2mm)- Tin Coated')}">View product</a></td></tr>
          <tr><td>82 x 20 x 2 mm</td><td>40 mm&sup2;</td><td><a href="${p('COPPER BUS BAR Universal (82x20x2mm)- Tin Coated')}">View product</a></td></tr>
        </tbody>
      </table>

      <h2>A simple way to size a busbar</h2>
      <p>Cross-section is width times thickness: 20 mm x 2 mm gives 40 mm&sup2;. A common rule of thumb for bare copper busbars in open air is roughly 1.2 to 1.5 A per mm&sup2; for continuous duty, which puts a 20 x 2 mm bar in the region of 50 to 60 A. Treat that as a starting point only. Derate for an enclosed pack, high ambient temperature (think summer in Rajasthan or Gujarat) and the quality of the bolted joint. For higher current, use a wider or thicker bar, or two bars in parallel. See our <a href="/copper-busbar-sizing-guide-battery-packs.html">copper busbar sizing guide</a> for more.</p>

      <h2>Assembly tips</h2>
      <ol>
        <li><strong>Clean flat contact faces.</strong> Dust or oil raises joint resistance.</li>
        <li><strong>Use the right bolt and washer set</strong> and tighten to the cell maker's torque. A loose joint heats up; an over-tight one can damage the terminal.</li>
        <li><strong>Re-check torque after the first heat cycles.</strong></li>
        <li><strong>Insulate exposed bars</strong> to prevent accidental shorts.</li>
      </ol>
      <p>Building a small cylindrical-cell pack instead? Read our <a href="/blog/pure-nickel-strip-lithium-battery-packs-india.html">pure nickel strip</a> and <a href="/blog/nickel-plated-strip-ev-battery-packs-india.html">plated strip</a> guides.</p>
      <p class="blog-note">General guidance only. Validate busbar size, torque and pack safety against your own design, the cell maker's data sheet and the standards that apply to your product.</p>`,
    faq: [
      ['What size copper busbar do I need for a 100 Ah LFP cell pack?', 'It depends on your continuous current, not the cell capacity alone. As a rough start, a 20 x 2 mm bar (40 mm²) suits tens of amps; for higher current use a larger section or parallel bars. Send us your pack current and we will advise.'],
      ['Why is the busbar tin coated?', 'Tin protects the copper from tarnishing, which keeps joint resistance low and stable, especially in humid and coastal Indian conditions.'],
      ['Do you make custom length copper busbars?', 'Yes. Send your terminal spacing, width, thickness and quantity, and we will quote a custom busbar.'],
      ['Is copper better than aluminium for battery busbars?', 'Copper conducts better, so a copper bar of the same section runs cooler. Aluminium is lighter and cheaper but needs a larger section and careful joint treatment.'],
      ['Do you supply copper busbars across India?', 'Yes, from Noida with GST invoice. If a size shows as out of stock, tap Notify Me and we will confirm availability on WhatsApp.'],
    ],
  },
]

// Existing guides that predate the blog; listed on the blog index.
export const guides = [
  { href: '/nickel-plated-vs-pure-nickel-strip.html', tag: 'Comparison', title: 'Nickel-Plated vs Pure Nickel Strip: Which One Do You Need?', text: 'Which one to use for your battery pack: cost, conductivity and corrosion compared.', heroImage: '/assets/products/nickel-plated/npl_10x.15mm_1.jpg', imageAlt: 'Nickel strip for battery pack welding' },
  { href: '/18650-21700-32650-nickel-strip-sizing-guide.html', tag: 'Sizing', title: '18650 vs 21700 vs 32650: Nickel Strip Sizing Guide', text: 'Cell dimensions, current ratings and how to pick strip width and thickness.', heroImage: '/assets/products/nickel-pure/np_2p_26x.15mm_1.jpg', imageAlt: 'Pure nickel 2P strip for 18650 cells' },
  { href: '/copper-busbar-sizing-guide-battery-packs.html', tag: 'Sizing', title: 'Copper Busbar Sizing Guide for Battery Packs', text: 'How to size busbar thickness and width for your pack current.', heroImage: '/assets/products/copper-bus-bars/universe_1.5mm_1.jpg', imageAlt: 'Copper busbars for battery packs' },
]
