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
    // Most recent first (by creation time).
    var sorted = items.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    itemList.textContent = "";

    if (sorted.length === 0) {
      emptyMessage.hidden = false;
      return;
    }
    emptyMessage.hidden = true;

    sorted.forEach(function (item) {
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

    li.appendChild(header);
    li.appendChild(details);
    return li;
  }

  // Append a <dt>/<dd> pair. Uses textContent so user text can't inject markup.
  function appendDetail(dl, label, value) {
    var dt = document.createElement("dt");
    dt.textContent = label;
    var dd = document.createElement("dd");
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
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

  // ---- Init ------------------------------------------------------------------

  form.addEventListener("submit", handleSubmit);
  render();
})();
