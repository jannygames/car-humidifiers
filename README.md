# DriveMist — Shopify theme

Car model humidifiers & aroma diffusers. Horizon base + Tailwind CSS v4, with the custom
`drivemist-*` section library. Same structure, apps and admin setup as the Colorens theme it was
cloned from — only the brand, copy, palette, icons and imagery changed.

Suggested domain: **drivemist.com** (unregistered as of 22 Oct 2026 — buy it before launch).

## Running it

```bash
npm install      # once
npm run dev      # builds Tailwind, then runs `tailwindcss --watch` + `shopify theme dev` together
```

`npm run dev` starts both processes under `concurrently`. Editing any `.liquid` file rebuilds
`assets/drivemist.css` and hot-reloads the preview.

| Script | What it does |
| --- | --- |
| `npm run dev` | Tailwind watch + `shopify theme dev` |
| `npm run build` | One-off minified CSS build |
| `npm run push` | Build CSS, push to the theme in `shopify.theme.toml` |
| `npm run push:new` | Build CSS, create a **new unpublished** theme called "DriveMist" |
| `npm run check` | `shopify theme check` |
| `npm run check:fonts` | Audit the served fonts for Lithuanian / Latvian / Polish coverage |

**Before the first run**, set your store in `shopify.theme.toml` (`store = "your-store"` — the
`*.myshopify.com` subdomain). If `shopify theme dev` fails with
`Setting 'page_width' must be a string/number`, run `npm run push:new` once and add that theme's
id to `shopify.theme.toml` under `[environments.development]`.

## Where things live

```
src/drivemist.css          Tailwind entry: brand tokens, @utility helpers, component CSS, animations
assets/drivemist.css       Build output (committed — Shopify serves this)
assets/drivemist.js        Scroll reveal, gallery, carousels, quantity, sticky ATC, bundle add
assets/drivemist-*.svg     Logo, inverse logo, favicon mark, animated hero scene
sections/drivemist-*       The DriveMist section library (all fully editable in the theme editor)
snippets/drivemist-*       Shared helpers: icon set, image, placeholder art, stars, surface, padding
config/settings_schema     "DriveMist brand" group — brand colours and glow palette
brand/                     Logo + favicon PNG/SVG exports for Shopify admin, socials, ads
```

Tailwind imports **utilities unlayered and skips Preflight**, so Horizon's own CSS keeps working.
Namespaced resets live under `.co` at class specificity. Never remove the `co` class from a
section root — the resets hang off it.

## Brand

**Name:** DriveMist — *drive* + *mist*: says exactly what the product does, 9 letters, easy to
spell after hearing it once, and carries the two main search terms (car + mist/humidifier).

**Logo:** a low coupe silhouette in a midnight badge with three cyan mist streams flowing off
the rear like airflow, next to an italic Barlow ExtraBold wordmark (*Drive* in ink, *Mist* in
teal). The wordmark is outlined to vector paths, so it renders identically everywhere. Files in
`brand/` and `assets/`.

| Token | Value | Used for |
| --- | --- | --- |
| Ink | `#12151b` | Text |
| Page | `#f5f7fa` | Main background — cool, not warm |
| Fog (sand) | `#e9eef3` | Alternating sections |
| Steel (shell) | `#d9e2ea` | Deeper surface (comparison, badges) |
| Midnight (deep) | `#0b1220` | Footer, ticker, trust band |
| Line | `#dbe2ea` | Hairlines |
| Muted | `#566170` | Secondary text |
| **Accent** | `#086683` | Eyebrows, icons, links. Deep mist teal, AA on every light surface |
| Accent (soft) | `#6fd3f0` | Mist cyan from the logo. Glows, fills, dots — never text on light |
| **CTA** | `#d03f12` | Add to cart, checkout, sale badges. "Ignition orange", 4.8:1 on white |
| Success | `#137a54` | Comparison ticks, in-stock dot |
| Glow palette | `#6fd3f0 #ff7a45 #ffc53d #8f7bff #5fd39a` | Step numbers, footer indicator lights |

**Cyan is the mist** (used constantly, quietly), **orange is the ignition** (rare, loud,
reserved for money buttons) — the same two-job split Colorens used.

Type: **Barlow 700** headings (inspired by highway signage — automotive without being a gimmick)
/ **Inter** body. Both set in Theme settings › Typography, both cover Latin Extended-A.

**Motion** (all disabled under `prefers-reduced-motion`): animated hero night scene with flowing
exhaust mist, headline sheen, headlight-sweep shine on CTA buttons, scroll reveal, drifting mist
edge on the footer, a tiny car cruising the footer road, pulsing indicator dots, and animated
mist on every placeholder image.

## Images

There are no product photos yet, so **every empty image slot renders branded placeholder art**
(`snippets/drivemist-placeholder.liquid`): a studio scene for product images, a night dashboard
scene for lifestyle images, and a dusk scene for the newsletter. The hero falls back to the
animated `assets/drivemist-hero.svg`. As soon as you pick a real image in the theme editor it
replaces the placeholder — nothing else to change.

## Setup checklist (Shopify admin)

1. **Store basics** — Settings › Store details: name **DriveMist**, sender email
   `info@drivemist.com`. Currency EUR (same as Colorens, needed for MakeCommerce).
2. **Products** — create the four products with these handles (the home page, 404 page and
   bundle already point at them):
   | Product | Handle |
   | --- | --- |
   | Nissan GT-R Car Humidifier | `nissan-gtr-car-humidifier` |
   | Bugatti Chiron Car Humidifier | `bugatti-chiron-car-humidifier` |
   | Dodge Challenger Car Humidifier | `dodge-challenger-car-humidifier` |
   | Pagani Car Humidifier | `pagani-car-humidifier` |
   | Garage Duo (bundle) | `garage-duo-car-humidifier-set` |

   Suggested SEO titles / meta descriptions are at the bottom of this file.
3. **Collection** — create *Car Humidifiers* (`car-humidifiers`) with all four models, then
   Customize › a collection page › *DriveMist collection* › **Collection to show**.
4. **Logo** — works out of the box from `assets/drivemist-logo.svg`. To manage it in the admin
   instead, upload `brand/drivemist-logo.png` in Theme settings › Logo and
   `brand/drivemist-favicon-512.png` as the favicon.
5. **Menus** — Navigation:
   - `main-menu`: Shop all, Nissan GT-R, Bugatti Chiron, Dodge Challenger, Pagani, About, FAQ,
     Track order
   - `footer`: Shipping, Returns, FAQ, Contact, Privacy, Terms
6. **Pages** — create these and set the template in the page sidebar:
   | Page | Handle | Template |
   | --- | --- | --- |
   | About DriveMist | `about` | `page.about` |
   | FAQ | `faq` | `page.faq` |
   | Contact | `contact` | `page.contact` |
   | Track your order | `track-your-order` | `page.track-order` |
   | Safe use guide | `safety` | `page.safety` — content in `SAFETY.md` |
   | Payments | `payments` | `page.payments` — content in `PAYMENTS.md` |
   | Shipping / Returns / Privacy / Terms | `shipping-policy` … | `page.policy` — content in `POLICIES.md` |
7. **Policies** — Settings › Policies, drafts in `POLICIES.md`.
8. **Business details** — replace the `[bracketed]` placeholders in Theme editor › Footer ›
   *Business details* and Contact page › *Business details* (and its Lithuanian context
   template, `page.contact.context.lt.json`). MakeCommerce requires these on every page.
9. **Apps** — install the same apps as Colorens; their embeds are already switched on in
   `config/settings_data.json`, so they activate on install:
   | App | Role | Where it hooks in |
   | --- | --- | --- |
   | Judge.me Reviews | Reviews + stars | Product page preview badge + review widget blocks are already placed |
   | Kaching Bundles | Quantity breaks / bundles | App embed |
   | BOGOS (free gifts) | Free gift with order | Product › *DriveMist product* › Add block, or selector `#drivemist-gift-slot` |
   | Mori Scratch Card Popup | Email capture discount | App embed; Lithuanian texts in `snippets/drivemist-scratch-popup-lt.liquid` |
   | MakeCommerce (payments + shipping) | Baltic banks, cards, parcel lockers | App embed |
   | Track123 | Order tracking | `page.track-order` frames `/apps/track123` |
   | Microsoft Clarity | Heatmaps | App embed |
   | ZB Facebook Messenger Chat | Chat (embed off by default, theme uses `drivemist-messenger`) | App embed |
   | Translate & Adapt | Lithuanian translations | Admin |
   | Google & YouTube / Shopping feed | Product feed | Admin |
10. **Per-product content (metafields)** — one product template serves every model.
    Everything model-specific comes from metafields; empty ones fall back to the section
    defaults. Settings › Custom data › Products › Add definition:

    | Namespace & key | Type | Fills | Example |
    | --- | --- | --- | --- |
    | `custom.eyebrow` | Single line text | Label above the title | `JDM legend` |
    | `custom.subtitle` | Single line text | Sentence under the title | `Cool mist from twin exhausts and glowing headlights` |
    | `custom.badge` | Single line text | Badge on the main image | `Bestseller` |
    | `custom.highlights` | Single line text, **list** | Selling-point bullets | `mist: Real exhaust mist effect` |
    | `custom.cert_*` | see Colorens docs | Certification badge (off by default) | `CE · FCC · RoHS` |

    Prefix a highlight with an icon name to change its icon. New car icons: `car mist wind usb
    gauge bolt bulb quiet steering key timer trophy` (the older names still work).

    **Metaobjects** (Settings › Custom data › Metaobjects, then a product metafield of type
    *Metaobject*, **List of entries**):
    | Metaobject | Fields | Product metafield | Fills |
    | --- | --- | --- | --- |
    | `product_spec` | `title`, `content` (rich text), `icon` | `custom.specs` | Accordion rows: in the box, specs, care |
    | `product_demo` | `media` (file), `heading`, `text`, `poster` | `custom.demos` | Clips under the buy box — 9:16 phone footage of the mist at night works best |

11. **Bundle discount** — the *Garage Duo* "Set discount" (€15) is display only. Create a
    matching automatic discount so it applies at checkout.
12. **Email capture** — the newsletter promises **10% off**; set up that welcome code in
    Shopify Email or the scratch-card app.

## Must be replaced or verified before launch

The theme ships with realistic sample copy. These make claims you have to make true (or edit):

- **Reviews and ratings** — the home page testimonials, "Loved by car enthusiasts" stars and
  review counts are **samples**. Replace them with real Judge.me reviews before taking orders;
  publishing invented reviews is illegal in the EU (Omnibus Directive).
- **Product claims** — exhaust mist, LED head/tail lights, USB 5 V power, auto shut-off,
  cup-holder fit, "whisper-quiet", contents of the box. Check each against the supplier's spec
  sheet for every model.
- **Delivery** — free tracked shipping, dispatch 1–2 days, delivery 7–14 working days
  (product page *Estimated delivery* setting + FAQs).
- **Returns** — 30 days, unused, in original packaging.
- **Prices** — €49 placeholders, Garage Duo €98 / €15 off.
- **Certification badge** — off by default; only switch on with real CE/FCC/RoHS documents.
- **Trademarks** — model names (Nissan GT-R, Bugatti Chiron, Dodge Challenger, Pagani) are
  manufacturers' trademarks. The Terms of service include a non-affiliation notice; consider
  adding "inspired" wording to product titles if a marketplace or ad platform flags them.
- `info@drivemist.com` and the `@drivemist` social handles — register them.

## SEO

- Home `<title>` and meta description live in the locale files (`drivemist.seo.*`), translated
  in Lithuanian; they target *car humidifier*, *car diffuser*, *car model humidifier* and the
  four model names.
- FAQ sections output `FAQPage` structured data (the *Enable schema* toggle).
- One `h1` per page; headings carry the main search terms.

Suggested product SEO fields (Products › *Search engine listing*):

| Product | Page title (≤ 60) | Meta description (≤ 155) |
| --- | --- | --- |
| Nissan GT-R | Nissan GT-R Car Humidifier & Aroma Diffuser – DriveMist | GT-R car model humidifier with real exhaust mist, LED headlights and USB power. The perfect gift for JDM fans. Free tracked shipping. |
| Bugatti Chiron | Bugatti Chiron Car Humidifier & Diffuser – DriveMist | Bugatti Chiron hypercar humidifier with exhaust mist effect, glowing lights and aroma diffuser. USB powered. Free tracked shipping. |
| Dodge Challenger | Dodge Challenger Car Humidifier & Diffuser – DriveMist | Muscle-car humidifier shaped like the Dodge Challenger: cool exhaust mist, LED lights, USB power. A gift for car lovers. Free shipping. |
| Pagani | Pagani Car Humidifier & Aroma Diffuser – DriveMist | Pagani supercar humidifier with quad-exhaust mist, LED light show and USB power. Car air freshener and desk humidifier in one. |
