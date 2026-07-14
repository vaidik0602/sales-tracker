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

  var itemList = document.getElementById("item-list");
  var emptyMessage = document.getElementById("empty-message");
  var filterButtons = document.querySelectorAll(".filter-btn");

  // Current status filter: "All", "Listed", or "Sold".
  var activeFilter = "All";

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

  // Find an item by id. Returns the item object or undefined.
  function findItem(id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return undefined;
  }

  // Format a number as a currency amount (no locale currency symbol assumptions).
  function formatMoney(num) {
    if (typeof num !== "number" || !isFinite(num)) return "—";
    return num.toFixed(2);
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

  function render() {
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
    amountLabel.textContent = "Amount received";
    var amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.step = "0.01";
    amountInput.min = "0";
    amountInput.inputMode = "decimal";
    amountInput.placeholder = "0.00";
    amountInput.className = "sell-amount";
    amountLabel.setAttribute("for", "sell-amount-" + item.id);
    amountInput.id = "sell-amount-" + item.id;
    amountField.appendChild(amountLabel);
    amountField.appendChild(amountInput);

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
    saveItems(items);
    render();
    form.reset();
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
    }
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

  form.addEventListener("submit", handleSubmit);
  itemList.addEventListener("click", handleListClick);
  itemList.addEventListener("submit", handleListSubmit);
  render();
})();
