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
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=82",
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
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1200&q=82",
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
  },
  {
    id: "finance-business-reporting",
    title: "Finance & Business Reporting",
    category: "Finance",
    status: "Live",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "An analytics dashboard showing business performance data",
    summary: "Students track revenue, expenses, margins, and product performance to build reports that support purchasing and operating decisions.",
    overview: "Students use store financial and product data to understand performance and turn it into practical reporting for purchasing and day-to-day operating decisions.",
    highlights: [
      "Revenue and expense tracking",
      "Margin and product-performance analysis",
      "Reports that support purchasing decisions",
      "Financial insight for store operations"
    ],
    tags: ["Finance", "Reporting", "Margins", "Product Performance", "Decision Support"]
  },
  {
    id: "marketing-campaigns-product-launches",
    title: "Marketing Campaigns & Product Launches",
    category: "Marketing",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Digital content and campaign work displayed on a computer",
    summary: "Student-led campaigns for new products, seasonal promotions, school events, and digital channels across the CO-OP.",
    overview: "Students plan and run campaigns that connect product launches, seasonal promotions, school events, and the CO-OP’s digital channels.",
    highlights: [
      "Campaign planning for new products",
      "Seasonal and school-event promotions",
      "Digital content across CO-OP channels",
      "Launch coordination and campaign improvement"
    ],
    tags: ["Marketing", "Campaigns", "Product Launches", "Digital Content", "Promotion"]
  },
  {
    id: "merchandise-design-vendor-sourcing",
    title: "Merchandise Design & Vendor Sourcing",
    category: "Retail & Design",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Apparel arranged for a merchandise launch",
    summary: "Students develop apparel concepts, compare blanks and vendors, set pricing, coordinate production, and prepare products for launch.",
    overview: "Students manage the merchandise-development process from early apparel concepts and material comparisons through vendor selection, pricing, production, and launch preparation.",
    highlights: [
      "Apparel concepts and product development",
      "Blank, material, and vendor comparisons",
      "Pricing and production coordination",
      "Product preparation for launch"
    ],
    tags: ["Merchandise", "Apparel Design", "Vendor Sourcing", "Pricing", "Production"]
  },
  {
    id: "visual-merchandising-store-displays",
    title: "Visual Merchandising & Store Displays",
    category: "Retail & Design",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "A retail interior with coordinated product displays",
    summary: "Planning product placement, displays, signage, fixtures, and seasonal layouts to improve the in-store shopping experience.",
    overview: "Students shape the in-store experience through product placement, display planning, signage, fixture decisions, and seasonal layouts.",
    highlights: [
      "Product placement and display planning",
      "Signage and fixture coordination",
      "Seasonal store layouts",
      "In-store shopping experience improvements"
    ],
    tags: ["Visual Merchandising", "Store Displays", "Signage", "Fixtures", "Retail Experience"]
  },
  {
    id: "purchasing-inventory-planning",
    title: "Purchasing & Inventory Planning",
    category: "Operations",
    status: "Live",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Organized merchandise inventory in a stock area",
    summary: "Students analyze sales, place product orders, manage stock levels, and balance availability with purchasing costs.",
    overview: "Students connect sales analysis with purchasing and inventory decisions, balancing product availability, stock levels, and the cost of each order.",
    highlights: [
      "Sales analysis for purchasing decisions",
      "Product ordering and replenishment",
      "Stock-level monitoring",
      "Availability and purchasing-cost balance"
    ],
    tags: ["Purchasing", "Inventory Planning", "Sales Analysis", "Stock Levels", "Operations"]
  },
  {
    id: "brand-partnerships-vendor-relations",
    title: "Brand Partnerships & Vendor Relations",
    category: "Business Development",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "A retail team coordinating business operations",
    summary: "Students work with vendors and outside partners on pricing, fulfillment, promotions, and new product opportunities.",
    overview: "Students build working relationships with vendors and outside partners to coordinate pricing, fulfillment, promotions, and potential additions to the CO-OP’s product mix.",
    highlights: [
      "Vendor and partner communication",
      "Pricing and fulfillment coordination",
      "Collaborative promotions",
      "New product opportunity development"
    ],
    tags: ["Business Development", "Partnerships", "Vendor Relations", "Fulfillment", "Product Development"]
  },
  {
    id: "customer-experience-feedback",
    title: "Customer Experience & Feedback",
    category: "Marketing",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "Students collaborating and sharing feedback",
    summary: "Using student feedback, sales behavior, and store observations to improve service, product selection, and the shopping experience.",
    overview: "Students combine direct feedback, sales behavior, and observations from the store to identify improvements to service, product selection, and the overall customer experience.",
    highlights: [
      "Student and customer feedback collection",
      "Sales-behavior analysis",
      "Store observation and service review",
      "Product-selection and experience improvements"
    ],
    tags: ["Customer Experience", "Feedback", "Sales Behavior", "Service", "Product Selection"]
  },
  {
    id: "event-sales-pop-up-retail",
    title: "Event Sales & Pop-Up Retail",
    category: "Retail & Community",
    status: "Ongoing",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=82",
    imageAlt: "A temporary mobile retail service setup",
    summary: "Students plan and operate temporary sales at school events, managing products, staffing, displays, and customer flow.",
    overview: "Students prepare and run temporary retail operations at school events, coordinating the products, people, displays, and customer flow needed for each location.",
    highlights: [
      "Pop-up planning for school events",
      "Product and staffing coordination",
      "Temporary display setup",
      "Customer-flow management"
    ],
    tags: ["Pop-Up Retail", "Event Sales", "Staffing", "Displays", "Community"]
  }
];

const categoryOrder = ["All", "Technology", "Operations", "Retail & Design", "Data", "Food & Community", "Finance", "Marketing", "Business Development", "Retail & Community"];
const stageOrder = ["Live", "Ongoing", "In Development", "Prototype", "Concept"];
const state = { query: "", category: "All", status: "all", sort: "featured" };

const grid = document.getElementById("project-grid");
const search = document.getElementById("project-search");
const statusFilterElement = document.getElementById("status-filter");
const sortElement = document.getElementById("project-sort");
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

let lastDeepLinkedProject = "";

function openProjectById(projectId) {
  const normalizedId = String(projectId || "").trim();
  if (!normalizedId || normalizedId === lastDeepLinkedProject) return;
  const project = projects.find(item => item.id === normalizedId);
  if (!project) return;
  lastDeepLinkedProject = normalizedId;
  openProject(project);
}

function resetFilters() {
  state.query = "";
  state.category = "All";
  state.status = "all";
  state.sort = "featured";
  search.value = "";
  statusDropdown.setValue("all");
  sortDropdown.setValue("featured");
  render();
}

function createCustomSelect(element, onChange) {
  const trigger = element.querySelector(".custom-select-trigger");
  const menu = element.querySelector(".custom-select-menu");
  const valueLabel = element.querySelector(".custom-select-value");
  const options = [...menu.querySelectorAll("[role='option']")];

  function selectedOption() {
    return options.find(option => option.getAttribute("aria-selected") === "true") || options[0];
  }

  function close(focusTrigger) {
    element.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
    if (focusTrigger) trigger.focus();
  }

  function open(focusOption) {
    document.querySelectorAll(".custom-select.is-open").forEach(other => {
      if (other === element) return;
      other.classList.remove("is-open");
      other.querySelector(".custom-select-trigger").setAttribute("aria-expanded", "false");
      other.querySelector(".custom-select-menu").hidden = true;
    });
    element.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    if (focusOption) window.requestAnimationFrame(() => selectedOption().focus());
  }

  function setValue(value, emitChange) {
    const next = options.find(option => option.dataset.value === value);
    if (!next) return;
    options.forEach(option => option.setAttribute("aria-selected", String(option === next)));
    valueLabel.textContent = next.textContent;
    if (emitChange) onChange(value);
  }

  trigger.addEventListener("click", () => {
    if (element.classList.contains("is-open")) close(false);
    else open(false);
  });
  trigger.addEventListener("keydown", event => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      open(true);
    }
  });
  options.forEach(option => {
    option.addEventListener("click", () => {
      setValue(option.dataset.value, true);
      close(true);
    });
  });
  menu.addEventListener("keydown", event => {
    const currentIndex = Math.max(0, options.indexOf(document.activeElement));
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    } else if (event.key === "Tab") {
      close(false);
      return;
    } else return;
    event.preventDefault();
    options[nextIndex].focus();
  });
  document.addEventListener("click", event => {
    if (!element.contains(event.target)) close(false);
  });

  return { setValue: value => setValue(value, false), close };
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

const statusDropdown = createCustomSelect(statusFilterElement, value => { state.status = value; render(); });
const sortDropdown = createCustomSelect(sortElement, value => { state.sort = value; render(); });

search.addEventListener("input", () => { state.query = search.value; render(); });
clearFilters.addEventListener("click", resetFilters);
emptyClear.addEventListener("click", resetFilters);
localClose.addEventListener("click", () => localDialog.close());
localDialog.addEventListener("click", event => { if (event.target === localDialog) localDialog.close(); });

document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");
  if (!link || window.parent === window) return;

  const url = new URL(link.href, window.location.href);
  const isSameDocumentAnchor =
    url.origin === window.location.origin &&
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash;
  if (isSameDocumentAnchor) return;

  event.preventDefault();
  window.parent.postMessage({ type: "rrhs-projects-navigate", href: url.href }, "*");
});

document.addEventListener("keydown", event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    search.focus();
  }
});

window.addEventListener("message", event => {
  if (event.data && event.data.type === "rrhs-projects-request-height") notifyHeight();
  if (event.data && event.data.type === "rrhs-projects-open-id") openProjectById(event.data.id);
});
window.addEventListener("load", notifyHeight);
window.addEventListener("resize", notifyHeight);
if (window.ResizeObserver) new ResizeObserver(notifyHeight).observe(document.body);
document.fonts && document.fonts.ready.then(notifyHeight);

render();

const initialProjectId = new URLSearchParams(window.location.search).get("project");
if (initialProjectId) window.requestAnimationFrame(() => openProjectById(initialProjectId));
