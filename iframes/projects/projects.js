const projects = [
  {
    id: "digital-commerce",
    title: "Digital Commerce Platform",
    category: "Technology",
    status: "Live",
    featured: true,
    image: "assets/digital-commerce.webp",
    imageAlt: "A team collaborating around laptops",
    summary: "A student-built storefront and ordering system connecting catalog, payment, fulfillment, inventory, and classroom delivery.",
    overview: "The CO-OP’s e-commerce work grew from early Wix Velo, Stripe, JavaScript, and inventory API experiments into a Lightspeed/Ecwid storefront used for real school-store operations. The team describes it as the first fully functional e-commerce system operating inside a U.S. school.",
    credits: "Developed by Varun Bhadurgatte Nagaraj and Abhi Mora.",
    highlights: [
      "Catalog and online ordering across more than 400 listings at one stage",
      "Payment verification, order states, history, and checkout validation",
      "Teacher room auto-selection and classroom delivery routing",
      "Inventory integration, packaging, fulfillment, and delivery completion"
    ],
    tags: ["Wix Velo", "Stripe", "JavaScript", "APIs", "Lightspeed", "Ecwid"],
    metrics: [{ value: "400+", label: "Listings at one stage" }, { value: "15K+", label: "Monthly views reported" }]
  },
  {
    id: "delivery-robotics",
    title: "Autonomous Delivery Robotics",
    category: "Technology",
    status: "Concept",
    image: "assets/delivery-robotics.webp",
    imageAlt: "An indoor autonomous service robot",
    summary: "A supervised school-delivery pilot exploring navigation, secure compartments, automation, and robotics education.",
    overview: "Students evaluated service robots including the Keenon ButlerBot W3 and, more recently, Pudu FlashBot models for a possible first-floor pilot in the main building. The project connects a practical delivery need with robotics, software development, automation, and AI learning.",
    highlights: [
      "LiDAR navigation, obstacle avoidance, and route planning",
      "Secure compartments, delivery zones, and location tracking",
      "ROS, SDK, and API integration research",
      "Speed limits, performance metrics, manual override, and emergency stop"
    ],
    tags: ["LiDAR", "ROS", "SDKs", "Route Planning", "Automation", "Safety"]
  },
  {
    id: "inventory-intelligence",
    title: "Inventory Intelligence",
    category: "Technology",
    status: "In Development",
    image: "assets/inventory-logistics.webp",
    imageAlt: "Organized inventory and packages in a distribution space",
    summary: "A live inventory-counting system combining a mobile app, barcode scanning, realtime data, and physical stock organization.",
    overview: "The inventory project connects software with the physical realities of a student store. A React Native counter app supports barcode-based counts through a Supabase realtime database, while manual fallback and backroom organization keep the process usable when conditions are imperfect.",
    highlights: [
      "Barcode scanning with a manual-count fallback",
      "Supabase realtime inventory records",
      "Merchandise visibility across store and backroom stock",
      "Physical organization, placement, and replenishment workflows"
    ],
    tags: ["React Native", "Supabase", "Barcodes", "Realtime Data", "Inventory"]
  },
  {
    id: "operations-automation",
    title: "Workforce & Operations Automation",
    category: "Operations",
    status: "In Development",
    image: "assets/operations-pos.webp",
    imageAlt: "A retail employee working with a point-of-sale terminal",
    summary: "Internal tools that reduce manual work across staffing, timekeeping, fulfillment, reporting, and order processing.",
    overview: "This program groups the systems students build to make everyday operations more dependable. Its scheduling engine uses Python-based constraints and heuristics to turn employee availability and school calendars into workable shifts, alongside related automation for timekeeping, reporting, fulfillment, and administration.",
    highlights: [
      "Employee availability, attendance, and staffing constraints",
      "A/B-day calendars and automated shift assignments",
      "Auto clock-out and employee workflow improvements",
      "Automated reports, order processing, and administrative systems"
    ],
    tags: ["Python", "Constraint Optimization", "Scheduling", "Reporting", "Workflows"]
  },
  {
    id: "smartfood-checker",
    title: "SmartFood Compliance Checker",
    category: "Food & Community",
    status: "Prototype",
    image: "assets/food-service.webp",
    imageAlt: "A food-service checkout counter",
    summary: "A software workflow for checking whether products meet school Smart Snacks and food-compliance requirements.",
    overview: "The checker connects technical work directly to food operations. It is designed to inspect product and nutrition information, extract the relevant details, and classify whether an item complies with the requirements that govern what the CO-OP can sell.",
    highlights: [
      "Automated inspection of product and nutrition information",
      "Web extraction with Selenium and BeautifulSoup",
      "OCR for information that is not available as structured data",
      "LLM-assisted classification paired with rule-based checks"
    ],
    tags: ["Python", "Selenium", "BeautifulSoup", "OCR", "LLM Classification"]
  },
  {
    id: "retail-redesign",
    title: "Retail Experience Redesign",
    category: "Retail & Design",
    status: "In Development",
    image: "assets/retail-redesign.webp",
    imageAlt: "A warmly lit retail interior with clothing displays",
    summary: "A full redesign of the physical store experience—from traffic flow and fixtures to lighting, signage, and merchandising.",
    overview: "Students are treating the store itself as a design system. The work brings together customer flow, product visibility, atmosphere, and day-to-day operations through a coordinated walnut and dark-wood retail aesthetic.",
    highlights: [
      "Slatwall, racks, shelving, merchandising tables, and mannequins",
      "Traffic-flow planning and product placement",
      "Warm lighting, signage, wall graphics, and digital displays",
      "Fixture and furniture decisions designed around daily use"
    ],
    tags: ["Retail Design", "Visual Merchandising", "Lighting", "Signage", "Space Planning"]
  },
  {
    id: "forecasting",
    title: "Data & Demand Forecasting",
    category: "Data",
    status: "Concept",
    image: "assets/data-forecasting.webp",
    imageAlt: "An analytics dashboard with charts and performance data",
    summary: "Using sales and inventory data to make better decisions about demand, purchasing, staffing, and product launches.",
    overview: "Forecasting turns the store’s historical data into forward-looking decisions. The concept connects sales patterns and inventory movement with practical questions: what to restock, how much merchandise to order, when demand changes, and where staffing may need to adjust.",
    highlights: [
      "Sales and inventory trend analysis",
      "Restocking and purchasing recommendations",
      "Merchandise quantity planning for launches",
      "Potential staffing and merchandising decision support"
    ],
    tags: ["Forecasting", "Sales Data", "Inventory Data", "Demand Planning", "Analytics"]
  },
  {
    id: "cafeteria-kiosk",
    title: "Cafeteria Kiosk",
    category: "Food & Community",
    status: "Live",
    image: "assets/operations-pos.webp",
    imageAlt: "A point-of-sale system in an operating retail environment",
    summary: "A student-led expansion designed around external food-service requirements, contractual restrictions, and real campus demand.",
    overview: "A student-led expansion of the CO-OP that required working directly with the school’s food-service provider to ensure the kiosk met their operating requirements. Because the provider’s contract included restrictions on competing food sales during lunch, the team had to design the kiosk’s products, hours, and procedures around those requirements while still creating a useful on-campus retail option.",
    highlights: [
      "Direct coordination with the school’s food-service provider",
      "Product and operating-hour decisions shaped by contract requirements",
      "Checkout, inventory, staffing, and product-availability workflows",
      "A high-volume service model adapted to the school day"
    ],
    tags: ["Stakeholder Management", "Food Service", "Contracts", "Retail Operations", "POS"]
  },
  {
    id: "food-trailer",
    title: "Food Trailer Initiative",
    category: "Food & Community",
    status: "In Development",
    image: "assets/food-trailer.webp",
    imageAlt: "A mobile food-service trailer with an open service window",
    summary: "A district-supported expansion bringing the CO-OP’s student-run food and retail operations into a mobile format.",
    overview: "The Food Trailer Initiative is part of the district-supported expansion of the CO-OP. Around $30,000 of the larger district investment was associated with the trailer, making it a significant infrastructure and business implementation project. The work also includes an exterior wrap and branding concept for the CO-OP’s mobile retail presence.",
    highlights: [
      "A mobile extension of the CO-OP’s food and retail operations",
      "Approximately $30,000 associated with the trailer investment",
      "Planning for the infrastructure and operations of a new service format",
      "Exterior wrap and branding development for the mobile presence"
    ],
    tags: ["Business Expansion", "Food Service", "Mobile Retail", "Operations", "Exterior Branding"]
  },
  {
    id: "chickfila-fulfillment",
    title: "Chick-fil-A Commerce & Fulfillment",
    category: "Food & Community",
    status: "Live",
    image: "assets/food-service.webp",
    imageAlt: "A food-service counter using a digital checkout system",
    summary: "A recurring student-run ordering and distribution workflow integrated into the official CO-OP storefront.",
    overview: "Students manage the systems behind a recurring food partnership: a dedicated e-commerce section, online ordering, distribution, fulfillment, customer communication, and demand management. The project applies the same discipline as a larger commerce operation on a concentrated, time-sensitive product line.",
    highlights: [
      "Dedicated storefront category and online ordering",
      "Recurring fulfillment and distribution procedures",
      "Customer communication around pickup and availability",
      "Demand planning for a time-sensitive product"
    ],
    tags: ["E-Commerce", "Fulfillment", "Food Service", "Customer Communication", "Demand"]
  },
  {
    id: "merchandise-program",
    title: "Merchandise Design & Launches",
    category: "Retail & Design",
    status: "Ongoing",
    image: "assets/merchandise.webp",
    imageAlt: "Apparel arranged on racks in a retail display",
    summary: "Student-developed spirit wear spanning design, product selection, pricing, ordering, photography, and launch.",
    overview: "The merchandise program gives students ownership of a complete product cycle. Work has included multi-design apparel launches, concrete product proposals such as a 72-unit Gildan G750 spirit shirt, and the imagery and storefront content needed to sell each release well.",
    highlights: [
      "Shirt and hoodie concepts selected and developed by students",
      "Product selection, pricing, quantities, and vendor ordering",
      "An eight-design apparel launch",
      "Product photography and e-commerce presentation"
    ],
    tags: ["Apparel Design", "Product Development", "Pricing", "Photography", "Launch Planning"]
  },
  {
    id: "campus-delivery",
    title: "Campus Delivery Program",
    category: "Food & Community",
    status: "Ongoing",
    image: "assets/community-delivery.webp",
    imageAlt: "A group collaborating in a school library",
    summary: "A student-run classroom delivery operation connecting online orders, fulfillment, routing, and community participation.",
    overview: "Campus delivery turns the online storefront into a school-wide service. Students receive and verify orders, package them, organize routes, deliver to classrooms, and record completion. The broader program also includes delivery participation involving FAC/SPED students.",
    highlights: [
      "Order verification, packaging, and classroom routing",
      "Delivery status and completion tracking",
      "Teacher and room association built into checkout",
      "FAC/SPED participation in the operating program"
    ],
    tags: ["Campus Service", "Routing", "Fulfillment", "Accessibility", "Community"]
  },
  {
    id: "website-design-system",
    title: "CO-OP Website & Design System",
    category: "Retail & Design",
    status: "Live",
    image: "assets/web-development.webp",
    imageAlt: "Source code displayed on a computer screen",
    summary: "A student-led redesign of the storefront and content experience, including the page you are viewing now.",
    overview: "The website project brings the CO-OP’s digital identity into one responsive system. It covers storefront navigation, category organization, landing pages, project storytelling, leadership and department pages, reusable visual tokens, and custom iframe experiences that work inside the existing commerce platform.",
    highlights: [
      "Homepage, category, About, Projects, and Leadership experiences",
      "Maroon editorial design system with responsive components",
      "Custom hosted iframes built around platform constraints",
      "Storefront presentation, reliability, and ongoing iteration"
    ],
    tags: ["Web Design", "UX", "HTML", "CSS", "JavaScript", "Responsive Design"]
  }
];

const categoryOrder = ["All", "Technology", "Operations", "Retail & Design", "Data", "Food & Community"];
const stageOrder = ["Live", "Ongoing", "In Development", "Prototype", "Concept"];
const state = { query: "", category: "All", status: "all", sort: "featured" };

const grid = document.getElementById("project-grid");
const search = document.getElementById("project-search");
const statusFilter = document.getElementById("status-filter");
const sort = document.getElementById("project-sort");
const categoryFilters = document.getElementById("category-filters");
const resultCount = document.getElementById("result-count");
const clearFilters = document.getElementById("clear-filters");
const emptyState = document.getElementById("empty-state");
const emptyClear = document.getElementById("empty-clear");
const localDialog = document.getElementById("local-project-dialog");
const localDialogContent = document.getElementById("local-dialog-content");
const localClose = localDialog.querySelector(".local-close");

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function searchableText(project) {
  return [project.title, project.category, project.status, project.summary, project.overview, project.credits || "", ...project.highlights, ...project.tags].join(" ").toLowerCase();
}

function projectCard(project, index) {
  const featuredClass = project.featured && state.sort === "featured" ? " is-featured" : "";
  return `
    <article class="project-card${featuredClass}">
      <button class="project-card-button" type="button" data-project-id="${escapeHTML(project.id)}" aria-label="Open details for ${escapeHTML(project.title)}">
        <div class="card-image">
          <img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.imageAlt)}" loading="lazy">
          <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <p class="card-category">${escapeHTML(project.category)}</p>
            <span class="status" data-status="${escapeHTML(project.status)}">${escapeHTML(project.status)}</span>
          </div>
          <h3>${escapeHTML(project.title)}</h3>
          <p class="card-summary">${escapeHTML(project.summary)}</p>
          <div class="card-footer"><span>View case study</span><span aria-hidden="true">→</span></div>
        </div>
      </button>
    </article>`;
}

function filteredProjects() {
  const query = state.query.trim().toLowerCase();
  const filtered = projects.filter(project => {
    const categoryMatch = state.category === "All" || project.category === state.category;
    const statusMatch = state.status === "all" || project.status === state.status;
    const searchMatch = !query || searchableText(project).includes(query);
    return categoryMatch && statusMatch && searchMatch;
  });

  return filtered.sort((a, b) => {
    if (state.sort === "az") return a.title.localeCompare(b.title);
    if (state.sort === "status") return stageOrder.indexOf(a.status) - stageOrder.indexOf(b.status) || a.title.localeCompare(b.title);
    return projects.indexOf(a) - projects.indexOf(b);
  });
}

function render() {
  const filtered = filteredProjects();
  grid.innerHTML = filtered.map(projectCard).join("");
  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "project" : "projects"} shown`;
  emptyState.hidden = filtered.length !== 0;
  grid.hidden = filtered.length === 0;
  clearFilters.hidden = !state.query && state.category === "All" && state.status === "all" && state.sort === "featured";
  categoryFilters.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === state.category)));
  grid.querySelectorAll("[data-project-id]").forEach(button => {
    button.addEventListener("click", () => openProject(projects.find(project => project.id === button.dataset.projectId)));
  });
  notifyHeight();
}

function detailMarkup(project) {
  const metrics = project.metrics ? `<div class="local-metrics">${project.metrics.map(metric => `<div><strong>${escapeHTML(metric.value)}</strong><span>${escapeHTML(metric.label)}</span></div>`).join("")}</div>` : "";
  return `
    <img class="local-detail-image" src="${escapeHTML(project.image)}" alt="${escapeHTML(project.imageAlt)}">
    <div class="local-detail-body">
      <p class="local-detail-kicker">${escapeHTML(project.category)} · ${escapeHTML(project.status)}</p>
      <h2 id="local-dialog-title">${escapeHTML(project.title)}</h2>
      <p>${escapeHTML(project.overview)}</p>
      ${project.credits ? `<p><strong>${escapeHTML(project.credits)}</strong></p>` : ""}
      ${metrics}
      <h3>What students built</h3>
      <ul>${project.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul>
      <p><strong>Skills and systems:</strong> ${project.tags.map(escapeHTML).join(" · ")}</p>
    </div>`;
}

function openProject(project) {
  if (!project) return;
  const payload = { ...project, image: new URL(project.image, window.location.href).href };
  if (window.parent !== window) {
    window.parent.postMessage({ type: "rrhs-project-open", project: payload }, "*");
  } else {
    localDialogContent.innerHTML = detailMarkup(project);
    localDialog.showModal();
  }
}

function resetFilters() {
  state.query = "";
  state.category = "All";
  state.status = "all";
  state.sort = "featured";
  search.value = "";
  statusFilter.value = "all";
  sort.value = "featured";
  render();
}

function notifyHeight() {
  window.requestAnimationFrame(() => {
    // Measure the last in-flow section instead of scrollHeight. Inside a tall
    // iframe, scrollHeight can never be shorter than the iframe viewport and
    // would leave a large blank area after filters reduce the project grid.
    const closing = document.querySelector(".closing");
    const height = Math.ceil(closing.getBoundingClientRect().bottom + window.scrollY);
    document.documentElement.dataset.pageHeight = String(height);
    window.parent.postMessage({ type: "rrhs-projects-height", height }, "*");
  });
}

categoryOrder.forEach(category => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.category = category;
  button.textContent = category;
  button.setAttribute("aria-pressed", String(category === "All"));
  button.addEventListener("click", () => { state.category = category; render(); });
  categoryFilters.appendChild(button);
});

stageOrder.filter(stage => projects.some(project => project.status === stage)).forEach(stage => {
  const option = document.createElement("option");
  option.value = stage;
  option.textContent = stage;
  statusFilter.appendChild(option);
});

search.addEventListener("input", () => { state.query = search.value; render(); });
statusFilter.addEventListener("change", () => { state.status = statusFilter.value; render(); });
sort.addEventListener("change", () => { state.sort = sort.value; render(); });
clearFilters.addEventListener("click", resetFilters);
emptyClear.addEventListener("click", resetFilters);
localClose.addEventListener("click", () => localDialog.close());
localDialog.addEventListener("click", event => { if (event.target === localDialog) localDialog.close(); });

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
  }
});

window.addEventListener("message", event => {
  if (event.data && event.data.type === "rrhs-projects-request-height") notifyHeight();
});
window.addEventListener("load", notifyHeight);
window.addEventListener("resize", notifyHeight);
if (window.ResizeObserver) new ResizeObserver(notifyHeight).observe(document.body);
document.fonts && document.fonts.ready.then(notifyHeight);

render();
