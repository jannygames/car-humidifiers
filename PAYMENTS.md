# Payments — page content (MakeCommerce requirement)

Create **Online Store → Pages → Add page**, title **Payments**, handle **`payments`**,
**Theme template: payments**. Paste the HTML through the editor's `<>` code view so the `<h2>`
headings survive — they build the contents list.

The footer already links to `/pages/payments`, so the handle must match. Add the Lithuanian
version through **Translate & Adapt** (title "Mokėjimai").

---

```html
<p>This page lists the payment methods accepted in the DriveMist online store, the currency we
charge in and how refunds work. Full conditions are in our
<a href="/pages/terms-of-service">Terms of service</a>.</p>

<h2>Currency</h2>

<p><strong>All payments are made in euros (€ / EUR).</strong> Every price on the website
includes VAT. The final order total, including delivery, is shown at checkout before you
pay.</p>

<h2>Payment platform</h2>

<p><strong>Payments are processed by the MakeCommerce.lt payment platform.</strong> The
platform is operated by:</p>

<p>Maksekeskus AS<br/>
Liivalaia 45, Tallinn 10145, Estonia<br/>
Registry code: 12268475</p>

<p>DriveMist never collects or stores your card details — they are handled by the payment
service provider in a secure environment.</p>

<h2>Payment methods</h2>

<ul>
<li><strong>Online banking in Lithuania</strong> — Swedbank, SEB, Luminor, Šiaulių bankas,
Citadele, Revolut</li>
<li><strong>Online banking in Latvia and Estonia</strong> — Swedbank, SEB, Luminor, Citadele,
LHV</li>
<li><strong>Payment cards</strong> — Visa, Visa Electron, Mastercard, Maestro</li>
</ul>

<p>The methods available for your order are shown at checkout and may vary by country and order
total.</p>

<h2>When you are charged</h2>

<p>Funds are charged as soon as the payment is confirmed. You receive an order confirmation by
email. If a payment fails, the order is not placed and the products are not reserved.</p>

<h2>Refunds</h2>

<ul>
<li>You may withdraw from the contract within <strong>14 days</strong> of receiving the goods
without giving a reason. DriveMist voluntarily extends this to <strong>30 days</strong> from
delivery for unused products in their original packaging.</li>
<li>Refunds are made <strong>to the same payment method</strong> you used, unless agreed
otherwise.</li>
<li>Refunds are issued <strong>within 14 days</strong> of receiving the returned item or proof
that it was sent.</li>
<li>Faulty products are repaired, replaced or refunded under the statutory 2-year legal
guarantee.</li>
</ul>

<p>See our <a href="/pages/returns-policy">Returns policy</a> for the full process.</p>

<h2>Business details</h2>

<p>DriveMist · [Legal business name], Reg. No. [0000000]<br/>
[Street address], [City], [Country]<br/>
Email: <a href="mailto:info@drivemist.com">info@drivemist.com</a></p>

<p>We reply to all enquiries within one working day.</p>
```

---

## Check before sending to MakeCommerce

1. **The payment method list is an example.** Confirm with MakeCommerce which banks and cards
   are enabled in your contract and keep only those.
2. **Business details** must match the footer, the contact page and this page exactly. Fill the
   `[bracketed]` placeholders in all three (Theme editor › Footer › Business details, and
   Contact page › Business details).
3. **Supplier question.** MakeCommerce asks separately whether goods ship from your own stock or
   from a supplier, and who the supplier is. That is answered by email, not on the website.
