const supportEmail = "rrhs_coop_store@roundrockisd.org";

const faqGroups = [
  {
    id: "top",
    title: "Top Questions",
    intro: "The questions most customers usually need before placing or checking an order.",
    items: [
      ["How long will my order take?", "Most orders are typically processed within about 20 minutes during active store operations. Timing can vary around school schedules, order volume, inventory checks, and student availability."],
      ["Can I return or exchange my order?", "All sales are generally final. If the CO-OP made a fulfillment error or your product arrived damaged or defective, contact the team promptly for assistance."],
      ["Can my order be delivered to me at school?", "Current RRHS students and staff may use available free in-school delivery options. Provide accurate recipient and location information when ordering."],
      ["Do you accept cash?", "The CO-OP's published payment policy describes the store as cashless. Use an accepted card or supported digital payment method."],
      ["Who actually runs this store?", "Students run the RRHS CO-OP under faculty supervision. The store gives students hands-on experience across retail, technology, finance, marketing, product development, inventory, and operations."]
    ]
  },
  {
    id: "about",
    title: "About the CO-OP",
    intro: "What the student-run store is, who operates it, and why it exists.",
    items: [
      ["What is the RRHS CO-OP?", "The Round Rock High School CO-OP is a student-run school store operating at RRHS under faculty supervision. Students participate in real retail, finance, marketing, inventory, technology, customer service, e-commerce, and fulfillment work."],
      ["Is the CO-OP an actual business or a classroom simulation?", "It is a real operating school store used as an educational environment. Students work with real products, customers, transactions, inventory, orders, vendors, and operational requirements."],
      ["Who sponsors the CO-OP?", "Mr. Eric Chaverria is the faculty sponsor of the Round Rock High School CO-OP."],
      ["Who can shop at the CO-OP?", "Students, staff, families, alumni, and members of the Round Rock community may purchase eligible products. Some services, such as in-school delivery, may be limited to current RRHS students and staff."],
      ["Where does the money from purchases go?", "Sales support the operation and development of the CO-OP and its student programs and projects."]
    ]
  },
  {
    id: "shopping",
    title: "Shopping & Products",
    intro: "Product availability, sizing, restocks, and what the store carries.",
    items: [
      ["What does the CO-OP sell?", "The CO-OP offers categories including food and drinks, Round Rock apparel and accessories, school supplies, Chick-fil-A items, and other merchandise offered through the store."],
      ["How do I know whether an item is in stock?", "Online availability reflects current inventory information, but inventory can change as students process in-person and online sales. An order may occasionally need to be adjusted or canceled if an inventory discrepancy occurs."],
      ["Will sold-out merchandise be restocked?", "Some products may be restocked while others may be limited releases. Restocking depends on demand, supplier availability, and purchasing decisions made by the CO-OP team."],
      ["How do I know what apparel size to order?", "Review any available sizing information before ordering. Because sales are generally final, customers are responsible for confirming the correct size, color, quantity, and item before checkout."],
      ["Can I request a specific product for the CO-OP to carry?", "Yes. Customers may contact the CO-OP with product suggestions. Suggestions are not guaranteed, but feedback helps student teams make merchandising decisions."]
    ]
  },
  {
    id: "ordering",
    title: "Ordering",
    intro: "Checkout, confirmations, cancellations, and order changes.",
    items: [
      ["How do I place an order?", "Choose products through the online store, select options and quantities, add them to your cart, enter checkout information, select an available fulfillment option, and complete payment."],
      ["What should I check before submitting my order?", "Confirm products, sizes, colors, quantities, contact information, fulfillment method, and any school delivery information before purchasing."],
      ["Can I change my order after submitting it?", "Changes are not guaranteed after an order has been submitted. Contact the CO-OP as soon as possible if you notice an error."],
      ["Can I cancel an order?", "Order cancellations are not guaranteed because orders may already have entered fulfillment. Contact the CO-OP promptly if you need assistance."],
      ["Why might my order take longer than expected?", "The CO-OP is operated by students during the school calendar. School schedules, holidays, student availability, inventory issues, and large order volumes can affect fulfillment times."]
    ]
  },
  {
    id: "pickup",
    title: "Pickup & Delivery",
    intro: "In-store pickup, in-school delivery, external shipping, and delivery timing.",
    items: [
      ["Is in-store pickup available?", "Yes. In-store pickup is available to customers and is listed as free."],
      ["When can I pick up my order?", "Orders should be picked up after you receive confirmation that the order is ready. Pickup occurs during applicable school or store operating hours."],
      ["Is in-school delivery available?", "Yes. In-school delivery is intended for current Round Rock High School students and staff."],
      ["What information do I need for school delivery?", "Provide the requested identifying and location information so the student fulfillment team can route the order correctly."],
      ["Does the CO-OP ship outside Round Rock High School?", "Published policy says external U.S. shipping may be available for parents, alumni, and non-local customers. International shipping is not currently supported."]
    ]
  },
  {
    id: "payments",
    title: "Payments",
    intro: "Accepted payment methods, security, taxes, and payment issues.",
    items: [
      ["What forms of payment does the CO-OP accept?", "The store accepts major credit cards, debit cards, and approved online payment platforms such as Apple Pay, Google Pay, or PayPal when supported by the storefront."],
      ["Are payments secure?", "Payments are processed through approved third-party payment gateways. The CO-OP does not store customers' full payment card numbers."],
      ["Can students see my credit card number?", "No. Full payment-card information is handled by third-party payment providers and is not stored or directly accessible by the student team."],
      ["Will I be charged sales tax?", "Applicable state and local sales tax will be charged as required by law."],
      ["What happens if my payment fails?", "An order may not be completed if payment cannot be authorized. Verify your billing information or try another supported payment method."]
    ]
  },
  {
    id: "returns",
    title: "Returns & Problems",
    intro: "Wrong items, damaged products, exchanges, and fulfillment support.",
    items: [
      ["Can I return an item because I changed my mind?", "The CO-OP's dedicated Returns page says all sales are final and that the CO-OP does not accept returns or exchanges."],
      ["Can I exchange apparel for another size?", "Exchanges are not accepted under the dedicated Returns page, so customers should confirm sizing before purchasing."],
      ["What if the CO-OP gives me the wrong item?", "Contact the CO-OP. An order incorrectly fulfilled by the store should be reported so the team can assess and correct the issue."],
      ["What if my product is damaged or defective?", "Contact the CO-OP promptly. The team can assess the issue and determine what support is available."],
      ["Are customized or limited products returnable?", "Products remain non-returnable, including limited-availability or custom products."]
    ]
  },
  {
    id: "students",
    title: "Students & Projects",
    intro: "How students work with the store, data, departments, and projects.",
    items: [
      ["Are students actually responsible for the online store?", "Yes. Students participate in running and improving the e-commerce storefront along with the physical CO-OP."],
      ["What kinds of projects do students build through the CO-OP?", "Student projects include e-commerce development, inventory systems, operations automation, store redesign, data and demand forecasting, Chick-fil-A systems, POS and Lightspeed development, robotics concepts, and the Cafeteria Kiosk."],
      ["Do students work with real customer data?", "Students may work with business and operational information needed for CO-OP activities under faculty supervision. Full payment-card information is not accessible to the student team."],
      ["Who leads the CO-OP?", "The executive leadership team includes the CEO, COO, and faculty sponsor, supported by student directors and managers across each operating department."],
      ["What departments does the CO-OP have?", "Current departments include Human Resources, Finance, Product, Lightspeed, Marketing, Cafeteria Kiosk, Inventory, and Chick-fil-A, along with executive leadership."]
    ]
  },
  {
    id: "privacy",
    title: "Privacy & Website",
    intro: "Customer information, accounts, cookies, and website behavior.",
    items: [
      ["What personal information does the CO-OP collect?", "The Privacy Policy lists information such as customer names, billing and shipping information, email addresses, phone numbers, order information, voluntary communications, and certain website-usage data."],
      ["Why does the CO-OP need my information?", "Information may be used to process and fulfill purchases, provide support, manage delivery, prevent fraud, analyze performance, and support supervised educational activities."],
      ["Does the CO-OP sell customer information?", "No. The Privacy Policy states that the CO-OP does not sell or rent personal information."],
      ["Does the website use cookies?", "Yes. Cookies may be used for essential functions such as the shopping cart and account session, as well as analytics and personalization where consent is provided."],
      ["What if the website is not working correctly?", "Try refreshing the page and checking your internet connection. If the problem continues or prevents you from placing or accessing an order, contact the CO-OP."]
    ]
  }
];

const searchInput = document.getElementById("faq-search");
const filterList = document.getElementById("filter-list");
const groupsContainer = document.getElementById("faq-groups");
const faqCount = document.getElementById("faq-count");
const emptyState = document.getElementById("empty-state");
const clearSearch = document.getElementById("clear-search");
const expandAllButton = document.getElementById("expand-all");
const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const quickContactLink = document.querySelector(".quick-contact a");

let activeCategory = "all";
let expandedAll = false;

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function highlight(text, query) {
  if (!query) return escapeHTML(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeHTML(text).replace(new RegExp(`(${escaped})`, "ig"), "<mark>$1</mark>");
}

function renderFilters() {
  const allCount = faqGroups.reduce((total, group) => total + group.items.length, 0);
  const filters = [{ id: "all", title: "All topics", count: allCount }, ...faqGroups.map(group => ({ id: group.id, title: group.title, count: group.items.length }))];
  filterList.innerHTML = filters.map(filter => `
    <button class="filter-button" type="button" data-filter="${escapeHTML(filter.id)}" aria-pressed="${filter.id === activeCategory}">
      <span>${escapeHTML(filter.title)}</span>
      <span>${filter.count}</span>
    </button>
  `).join("");
  filterList.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.filter;
      render();
      const target = activeCategory === "all" ? document.getElementById("faq") : document.getElementById(`group-${activeCategory}`);
      scrollToElement(target);
    });
  });
}

function render() {
  const query = normalize(searchInput.value);
  let visibleCount = 0;

  groupsContainer.innerHTML = faqGroups.map(group => {
    const categoryVisible = activeCategory === "all" || activeCategory === group.id;
    const items = group.items.filter(([question, answer]) => {
      const searchVisible = !query || normalize(`${question} ${answer} ${group.title}`).includes(query);
      return categoryVisible && searchVisible;
    });
    visibleCount += items.length;
    return `
      <section class="faq-group" id="group-${escapeHTML(group.id)}" ${items.length ? "" : "hidden"}>
        <div class="faq-group-head">
          <h3>${escapeHTML(group.title)}</h3>
          <p>${escapeHTML(group.intro)}</p>
        </div>
        <div class="faq-items">
          ${items.map(([question, answer], index) => `
            <article class="faq-item ${expandedAll || (index === 0 && !query) ? "is-open" : ""}">
              <button class="faq-question" type="button" aria-expanded="${expandedAll || (index === 0 && !query)}">
                <span>${highlight(question, query)}</span>
                <span class="faq-icon" aria-hidden="true"></span>
              </button>
              <div class="faq-answer">
                <div class="faq-answer-inner"><p>${highlight(answer, query)}</p></div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }).join("");

  renderFilters();
  faqCount.textContent = `${visibleCount} ${visibleCount === 1 ? "answer" : "answers"} shown`;
  emptyState.hidden = visibleCount !== 0;
  expandAllButton.textContent = expandedAll ? "Collapse all" : "Expand all";
  groupsContainer.querySelectorAll(".faq-question").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      item.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(item.classList.contains("is-open")));
      window.setTimeout(notifyHeight, 260);
    });
  });
  notifyHeight();
}

function resetSearch() {
  searchInput.value = "";
  activeCategory = "all";
  expandedAll = false;
  render();
}

function formMailtoURL(form) {
  const data = new FormData(form);
  const subject = encodeURIComponent("RRHS CO-OP FAQ question");
  const body = encodeURIComponent([
    `Name: ${data.get("name") || ""}`,
    `Email: ${data.get("email") || ""}`,
    `Topic: ${data.get("topic") || ""}`,
    `Order number: ${data.get("order_number") || ""}`,
    "",
    data.get("message") || ""
  ].join("\n"));
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}

function notifyHeight() {
  window.requestAnimationFrame(() => {
    const last = document.querySelector(".contact");
    const faq = document.getElementById("faq");
    const stickyNav = document.querySelector(".side-nav");
    const contact = document.getElementById("contact");
    const height = Math.ceil(last.getBoundingClientRect().bottom + window.scrollY);
    const topFor = element => element ? Math.round(element.getBoundingClientRect().top + window.scrollY) : 0;
    document.documentElement.dataset.pageHeight = String(height);
    window.parent.postMessage({ type: "rrhs-faq-height", height }, "*");
    window.parent.postMessage({
      type: "rrhs-faq-metrics",
      height,
      faqTop: topFor(faq),
      stickyStart: topFor(stickyNav),
      contactTop: topFor(contact)
    }, "*");
  });
}

function scrollToElement(target) {
  if (!target) return;
  const top = Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY - 18));
  window.parent.postMessage({ type: "rrhs-faq-scroll-to", top }, "*");
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

searchInput.addEventListener("input", () => {
  expandedAll = false;
  render();
});
clearSearch.addEventListener("click", resetSearch);
expandAllButton.addEventListener("click", () => {
  expandedAll = !expandedAll;
  render();
});
if (quickContactLink) {
  quickContactLink.addEventListener("click", event => {
    event.preventDefault();
    scrollToElement(document.getElementById("contact"));
  });
}

contactForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = contactForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  formStatus.textContent = "Sending...";
  try {
    const response = await fetch(contactForm.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(contactForm)
    });
    if (!response.ok) throw new Error("Form service rejected the request.");
    contactForm.reset();
    formStatus.textContent = "Sent. If this is the first submission, the CO-OP inbox may need to approve FormSubmit's activation email.";
  } catch (error) {
    const mailto = formMailtoURL(contactForm);
    formStatus.innerHTML = `The direct send did not complete. <a href="${escapeHTML(mailto)}" target="_top">Open your email app instead</a>.`;
  } finally {
    submitButton.disabled = false;
    notifyHeight();
  }
});

window.addEventListener("message", event => {
  if (event.data && event.data.type === "rrhs-faq-request-height") notifyHeight();
  if (event.data && event.data.type === "rrhs-faq-scroll-to-id") {
    scrollToElement(document.getElementById(event.data.id));
  }
});
window.addEventListener("load", notifyHeight);
window.addEventListener("resize", notifyHeight);

render();
