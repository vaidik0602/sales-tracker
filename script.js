// Sales Tracker — client-side logic.
// All data is stored in the browser's localStorage. Nothing is sent anywhere.

(function () {
  "use strict";

  var STORAGE_KEY = "salesTracker.items";

  // ---- Data layer -----------------------------------------------------------

  // Load all items from localStorage. Returns an array (empty if none / invalid).
  function loadItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      // Corrupt or unavailable storage — start clean rather than crash.
      return [];
    }
  }

  // Persist the full items array to localStorage.
  function saveItems(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      alert("Could not save your data. Your browser storage may be full or disabled.");
    }
  }

  // Generate a reasonably unique id without external dependencies.
  function generateId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  var items = loadItems();

  // ---- DOM references --------------------------------------------------------

  var form = document.getElementById("item-form");
  var idField = document.getElementById("item-id");
  var descriptionInput = document.getElementById("description");
  var dateAcquiredInput = document.getElementById("date-acquired");
  var costInput = document.getElementById("cost");
  var listingPriceInput = document.getElementById("listing-price");
  var formError = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");
  var cancelEditBtn = document.getElementById("cancel-edit-btn");
  var formHeading = document.getElementById("form-heading");

  var itemList = document.getElementById("item-list");
  var emptyMessage = document.getElementById("empty-message");
  var filterButtons = document.querySelectorAll(".filter-btn");

  // Dashboard elements.
  var dash = {
    listedCount: document.getElementById("listed-count"),
    listedValue: document.getElementById("listed-value"),
    weekProfit: document.getElementById("week-profit"),
    weekSpent: document.getElementById("week-spent"),
    weekSold: document.getElementById("week-sold"),
    monthProfit: document.getElementById("month-profit"),
    monthSpent: document.getElementById("month-spent"),
    monthSold: document.getElementById("month-sold"),
    allProfit: document.getElementById("all-profit"),
    allSpent: document.getElementById("all-spent"),
    allSold: document.getElementById("all-sold")
  };

  // Current status filter: "All", "Listed", or "Sold".
  var activeFilter = "All";

  // Tab navigation.
  var tabButtons = document.querySelectorAll(".tab");
  var views = {
    dashboard: document.getElementById("view-dashboard"),
    add: document.getElementById("view-add"),
    items: document.getElementById("view-items")
  };

  // Show one view and highlight its tab. Scrolls back to the top.
  function switchTab(name) {
    if (!views[name]) return;
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("is-active", key === name);
    });
    Array.prototype.forEach.call(tabButtons, function (btn) {
      var isActive = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("is-active", isActive);
      if (isActive) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
    window.scrollTo(0, 0);
  }

  // ---- Helpers ---------------------------------------------------------------

  // Parse a currency-style input. Returns a finite number, or null if invalid.
  function parseMoney(value) {
    if (typeof value !== "string") value = String(value == null ? "" : value);
    var trimmed = value.trim();
    if (trimmed === "") return null;
    // Reject anything that isn't a plain non-negative decimal number.
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
    var num = Number(trimmed);
    return isFinite(num) ? num : null;
  }

  // Today's date as a YYYY-MM-DD string (local time), for date-input defaults.
  function todayIso() {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  // Parse a YYYY-MM-DD string into a local Date at midnight. Null if invalid.
  function parseIsoDate(str) {
    if (typeof str !== "string") return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // Start of the current week (Monday, local midnight).
  function startOfWeek() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var day = d.getDay(); // 0 = Sunday ... 6 = Saturday
    var diff = (day === 0 ? 6 : day - 1); // days since Monday
    d.setDate(d.getDate() - diff);
    return d;
  }

  // Start of the current month (local midnight).
  function startOfMonth() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // Find an item by id. Returns the item object or undefined.
  function findItem(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return undefined;
  }

  // Format a number as a British pound amount, e.g. 12.5 -> "£12.50",
  // -3 -> "-£3.00". Returns "—" for missing/invalid values.
  function formatMoney(num) {
    if (typeof num !== "number" || !isFinite(num)) return "—";
    var sign = num < 0 ? "-" : "";
    return sign + "£" + Math.abs(num).toFixed(2);
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearFormError() {
    formError.textContent = "";
    formError.hidden = true;
  }

  // ---- Rendering -------------------------------------------------------------

  // Recompute and paint the totals dashboard.
  function renderDashboard() {
    var weekStart = startOfWeek();
    var monthStart = startOfMonth();

    var listedCount = 0;
    var listedValue = 0;
    var week = { profit: 0, spent: 0, sold: 0 };
    var month = { profit: 0, spent: 0, sold: 0 };
    var all = { profit: 0, spent: 0, sold: 0 };

    items.forEach(function (item) {
      if (item.status === "Listed") {
        listedCount += 1;
        if (typeof item.listingPrice === "number") listedValue += item.listingPrice;
        return;
      }

      if (item.status === "Sold") {
        var profit = typeof item.profit === "number" ? item.profit : 0;
        var cost = typeof item.cost === "number" ? item.cost : 0;

        // All-time totals count every sold item, regardless of sold date.
        all.profit += profit;
        all.spent += cost;
        all.sold += 1;

        var soldDate = parseIsoDate(item.dateSold);
        if (!soldDate) return;

        if (soldDate >= monthStart) {
          month.profit += profit;
          month.spent += cost;
          month.sold += 1;
        }
        if (soldDate >= weekStart) {
          week.profit += profit;
          week.spent += cost;
          week.sold += 1;
        }
      }
    });

    dash.listedCount.textContent = String(listedCount);
    dash.listedValue.textContent = formatMoney(listedValue);

    setStat(dash.weekProfit, week.profit, true);
    dash.weekSpent.textContent = formatMoney(week.spent);
    dash.weekSold.textContent = String(week.sold);

    setStat(dash.monthProfit, month.profit, true);
    dash.monthSpent.textContent = formatMoney(month.spent);
    dash.monthSold.textContent = String(month.sold);

    setStat(dash.allProfit, all.profit, true);
    dash.allSpent.textContent = formatMoney(all.spent);
    dash.allSold.textContent = String(all.sold);
  }

  // Set a stat value, optionally applying profit/loss colour.
  function setStat(el, value, colourByProfit) {
    el.textContent = formatMoney(value);
    if (colourByProfit) {
      el.classList.toggle("profit-positive", value > 0);
      el.classList.toggle("profit-negative", value < 0);
    }
  }

  function render() {
    renderDashboard();

    // Apply the active status filter, then sort most recent first.
    var visible = items.filter(function (item) {
      return activeFilter === "All" || item.status === activeFilter;
    });
    visible.sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    itemList.textContent = "";

    if (visible.length === 0) {
      emptyMessage.hidden = false;
      emptyMessage.textContent = items.length === 0
        ? "No items yet. Add your first one above."
        : "No " + activeFilter.toLowerCase() + " items.";
      return;
    }
    emptyMessage.hidden = true;

    visible.forEach(function (item) {
      itemList.appendChild(buildItemRow(item));
    });
  }

  // Build a single list entry using safe DOM APIs (no innerHTML concatenation).
  function buildItemRow(item) {
    var li = document.createElement("li");
    li.className = "item";
    li.setAttribute("data-id", item.id);

    var header = document.createElement("div");
    header.className = "item-header";

    var title = document.createElement("span");
    title.className = "item-title";
    title.textContent = item.description;

    var status = document.createElement("span");
    status.className = "badge badge-" + item.status.toLowerCase();
    status.textContent = item.status;

    header.appendChild(title);
    header.appendChild(status);

    var details = document.createElement("dl");
    details.className = "item-details";
    appendDetail(details, "Acquired", item.dateAcquired);
    appendDetail(details, "Cost", formatMoney(item.cost));
    appendDetail(details, "Listed for", formatMoney(item.listingPrice));

    if (item.status === "Sold") {
      appendDetail(details, "Sold on", item.dateSold);
      appendDetail(details, "Received", formatMoney(item.amountReceived));
      var profitValue = appendDetail(details, "Profit", formatMoney(item.profit));
      if (typeof item.profit === "number") {
        profitValue.classList.add(item.profit >= 0 ? "profit-positive" : "profit-negative");
      }
    }

    li.appendChild(header);
    li.appendChild(details);
    li.appendChild(buildActions(item));
    return li;
  }

  // Build the actions row for an item (mark-as-sold for Listed items).
  function buildActions(item) {
    var actions = document.createElement("div");
    actions.className = "item-actions";

    if (item.status === "Listed") {
      var sellBtn = document.createElement("button");
      sellBtn.type = "button";
      sellBtn.className = "btn btn-small btn-primary";
      sellBtn.setAttribute("data-action", "sell");
      sellBtn.textContent = "Mark as sold";
      actions.appendChild(sellBtn);
    }

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small btn-ghost";
    editBtn.setAttribute("data-action", "edit");
    editBtn.textContent = "Edit";
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-small btn-danger";
    deleteBtn.setAttribute("data-action", "delete");
    deleteBtn.textContent = "Delete";
    actions.appendChild(deleteBtn);

    return actions;
  }

  // Build the inline "mark as sold" form for a specific item.
  function buildSellForm(item) {
    var wrapper = document.createElement("form");
    wrapper.className = "sell-form";
    wrapper.setAttribute("data-sell-form", item.id);
    wrapper.setAttribute("novalidate", "novalidate");

    var amountField = document.createElement("div");
    amountField.className = "field";
    var amountLabel = document.createElement("label");
    amountLabel.textContent = "Amount received (£)";
    var amountWrap = document.createElement("div");
    amountWrap.className = "money-input";
    var amountPrefix = document.createElement("span");
    amountPrefix.className = "money-prefix";
    amountPrefix.setAttribute("aria-hidden", "true");
    amountPrefix.textContent = "£";
    var amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.step = "0.01";
    amountInput.min = "0";
    amountInput.inputMode = "decimal";
    amountInput.placeholder = "0.00";
    amountInput.className = "sell-amount";
    amountLabel.setAttribute("for", "sell-amount-" + item.id);
    amountInput.id = "sell-amount-" + item.id;
    amountWrap.appendChild(amountPrefix);
    amountWrap.appendChild(amountInput);
    amountField.appendChild(amountLabel);
    amountField.appendChild(amountWrap);

    var dateField = document.createElement("div");
    dateField.className = "field";
    var dateLabel = document.createElement("label");
    dateLabel.textContent = "Date sold";
    var dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "sell-date";
    dateLabel.setAttribute("for", "sell-date-" + item.id);
    dateInput.id = "sell-date-" + item.id;
    dateInput.value = todayIso();
    dateField.appendChild(dateLabel);
    dateField.appendChild(dateInput);

    var error = document.createElement("p");
    error.className = "error-message sell-error";
    error.setAttribute("role", "alert");
    error.hidden = true;

    var buttons = document.createElement("div");
    buttons.className = "form-actions";
    var saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn-small btn-primary";
    saveBtn.textContent = "Save sale";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-small btn-ghost";
    cancelBtn.setAttribute("data-action", "cancel-sell");
    cancelBtn.textContent = "Cancel";
    buttons.appendChild(saveBtn);
    buttons.appendChild(cancelBtn);

    wrapper.appendChild(amountField);
    wrapper.appendChild(dateField);
    wrapper.appendChild(error);
    wrapper.appendChild(buttons);
    return wrapper;
  }

  // Append a <dt>/<dd> pair. Uses textContent so user text can't inject markup.
  function appendDetail(dl, label, value) {
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
    return dd;
  }

  // ---- Form handling ---------------------------------------------------------

  function handleSubmit(event) {
    event.preventDefault();
    clearFormError();

    var description = descriptionInput.value.trim();
    var dateAcquired = dateAcquiredInput.value; // native date input -> YYYY-MM-DD
    var cost = parseMoney(costInput.value);
    var listingPrice = parseMoney(listingPriceInput.value);

    if (description === "") {
      showFormError("Please enter a description.");
      return;
    }
    if (!dateAcquired) {
      showFormError("Please choose the date you acquired the item.");
      return;
    }
    if (cost === null) {
      showFormError("Item cost must be a valid number (e.g. 12.50).");
      return;
    }
    if (listingPrice === null) {
      showFormError("Listing price must be a valid number (e.g. 20.00).");
      return;
    }

    var editingId = idField.value;
    if (editingId) {
      // Update an existing item, preserving its status/sold data.
      var existing = findItem(editingId);
      if (existing) {
        existing.description = description;
        existing.dateAcquired = dateAcquired;
        existing.cost = cost;
        existing.listingPrice = listingPrice;
        // If already sold, keep profit in sync with the new cost.
        if (existing.status === "Sold" && typeof existing.amountReceived === "number") {
          existing.profit = existing.amountReceived - cost;
        }
      }
    } else {
      var newItem = {
        id: generateId(),
        description: description,
        dateAcquired: dateAcquired,
        cost: cost,
        listingPrice: listingPrice,
        status: "Listed",
        amountReceived: null,
        dateSold: null,
        profit: null,
        createdAt: Date.now()
      };
      items.push(newItem);
    }

    saveItems(items);
    render();
    resetForm();
    // Land on the Items list so the saved item is visible.
    switchTab("items");
  }

  // ---- List interactions (event delegation) ---------------------------------

  // Handle clicks within the item list (mark-as-sold, cancel).
  function handleListClick(event) {
    var actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    var li = actionEl.closest(".item");
    if (!li) return;
    var id = li.getAttribute("data-id");
    var action = actionEl.getAttribute("data-action");

    if (action === "sell") {
      openSellForm(li, id);
    } else if (action === "cancel-sell") {
      render(); // re-render discards the inline form
    } else if (action === "edit") {
      startEdit(id);
    } else if (action === "delete") {
      deleteItem(id);
    }
  }

  // Load an item into the top form for editing.
  function startEdit(id) {
    var item = findItem(id);
    if (!item) return;
    clearFormError();
    idField.value = item.id;
    descriptionInput.value = item.description;
    dateAcquiredInput.value = item.dateAcquired;
    costInput.value = item.cost;
    listingPriceInput.value = item.listingPrice;
    submitBtn.textContent = "Update item";
    cancelEditBtn.hidden = false;
    formHeading.textContent = "Edit item";
    switchTab("add");
    descriptionInput.focus();
  }

  // Reset the top form back to "add" mode.
  function resetForm() {
    form.reset();
    idField.value = "";
    submitBtn.textContent = "Save item";
    cancelEditBtn.hidden = true;
    formHeading.textContent = "Add item";
    clearFormError();
  }

  // Delete an item after confirmation.
  function deleteItem(id) {
    var item = findItem(id);
    if (!item) return;
    var ok = window.confirm("Delete \"" + item.description + "\"? This can't be undone.");
    if (!ok) return;
    items = items.filter(function (it) {
      return it.id !== id;
    });
    saveItems(items);
    // If we were editing this item, clear the form.
    if (idField.value === id) resetForm();
    render();
  }

  // Replace an item's action row with the inline sell form.
  function openSellForm(li, id) {
    var item = findItem(id);
    if (!item) return;
    // Remove any existing sell form already open in the list.
    var existing = itemList.querySelector(".sell-form");
    if (existing) render();
    var freshLi = itemList.querySelector('.item[data-id="' + cssEscape(id) + '"]') || li;
    var actions = freshLi.querySelector(".item-actions");
    if (actions) actions.hidden = true;
    freshLi.appendChild(buildSellForm(item));
    var amount = freshLi.querySelector(".sell-amount");
    if (amount) amount.focus();
  }

  // Handle submission of an inline sell form.
  function handleListSubmit(event) {
    var sellForm = event.target.closest("[data-sell-form]");
    if (!sellForm) return;
    event.preventDefault();

    var id = sellForm.getAttribute("data-sell-form");
    var item = findItem(id);
    if (!item) return;

    var error = sellForm.querySelector(".sell-error");
    var amount = parseMoney(sellForm.querySelector(".sell-amount").value);
    var dateSold = sellForm.querySelector(".sell-date").value;

    if (amount === null) {
      showInlineError(error, "Amount received must be a valid number (e.g. 18.00).");
      return;
    }
    if (!dateSold) {
      showInlineError(error, "Please choose the date it sold.");
      return;
    }

    item.status = "Sold";
    item.amountReceived = amount;
    item.dateSold = dateSold;
    item.profit = amount - item.cost;

    saveItems(items);
    render();
  }

  function showInlineError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  // Minimal CSS attribute-selector escaper for our generated ids.
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  // ---- Init ------------------------------------------------------------------

  // Wire up the status filter buttons.
  Array.prototype.forEach.call(filterButtons, function (btn) {
    btn.addEventListener("click", function () {
      activeFilter = btn.getAttribute("data-filter");
      Array.prototype.forEach.call(filterButtons, function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      render();
    });
  });

  // Wire up the bottom tab bar.
  Array.prototype.forEach.call(tabButtons, function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  form.addEventListener("submit", handleSubmit);
  cancelEditBtn.addEventListener("click", function () {
    resetForm();
    switchTab("items");
  });
  itemList.addEventListener("click", handleListClick);
  itemList.addEventListener("submit", handleListSubmit);
  render();
})();
