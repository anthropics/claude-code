(function () {
  "use strict";

  var citySelect = document.getElementById("city-select");
  var cityName = document.getElementById("city-name");
  var cityBlurb = document.getElementById("city-blurb");
  var listEl = document.getElementById("beverage-list");
  var filterButtons = document.querySelectorAll(".filter-btn");

  var state = {
    cityId: null,
    filter: "all",
    markers: [], // { id, marker, beverage }
    activeId: null,
  };

  var map = L.map("map", { scrollWheelZoom: true }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Populate city select.
  window.CITIES.forEach(function (city) {
    var opt = document.createElement("option");
    opt.value = city.id;
    opt.textContent = city.name;
    citySelect.appendChild(opt);
  });

  citySelect.addEventListener("change", function () {
    setCity(citySelect.value);
  });

  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterButtons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      state.filter = btn.getAttribute("data-filter");
      render();
    });
  });

  function beverageId(city, bev, idx) {
    return city.id + "-" + idx;
  }

  function stars(rating) {
    var full = Math.floor(rating);
    var half = rating - full >= 0.25 && rating - full < 0.75;
    if (rating - full >= 0.75) full += 1;
    var out = "";
    for (var i = 0; i < full; i++) out += "\u2605";
    if (half) out += "\u00BD";
    var empty = 5 - full - (half ? 1 : 0);
    for (var j = 0; j < empty; j++) out += "\u2606";
    return out;
  }

  function typeEmoji(type) {
    return type === "beer" ? "\uD83C\uDF7A" : "\uD83C\uDF77";
  }

  function getCity(id) {
    for (var i = 0; i < window.CITIES.length; i++) {
      if (window.CITIES[i].id === id) return window.CITIES[i];
    }
    return null;
  }

  function clearMarkers() {
    state.markers.forEach(function (m) {
      map.removeLayer(m.marker);
    });
    state.markers = [];
  }

  function makeIcon(type) {
    var color = type === "beer" ? "#d19a2b" : "#8a1f3a";
    var emoji = typeEmoji(type);
    var html =
      '<div style="background:' +
      color +
      ';color:white;border:2px solid white;border-radius:50%;' +
      "width:32px;height:32px;display:flex;align-items:center;justify-content:center;" +
      'font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">' +
      emoji +
      "</div>";
    return L.divIcon({
      className: "bev-marker",
      html: html,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -14],
    });
  }

  function popupHTML(bev) {
    return (
      '<div class="popup">' +
      "<h3>" +
      escapeHtml(bev.name) +
      "</h3>" +
      '<div class="venue">' +
      escapeHtml(bev.venue) +
      "</div>" +
      '<div class="rating"><span class="stars">' +
      stars(bev.rating) +
      '</span> <span class="rating-num">' +
      bev.rating.toFixed(1) +
      "</span></div>" +
      '<p class="desc">' +
      escapeHtml(bev.description) +
      "</p>" +
      "</div>"
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setActive(id) {
    state.activeId = id;
    // Update cards.
    var cards = listEl.querySelectorAll(".card");
    cards.forEach(function (c) {
      c.classList.toggle("active", c.getAttribute("data-id") === id);
    });
    // Scroll active card into view.
    var active = listEl.querySelector('.card[data-id="' + id + '"]');
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest" });
    // Open corresponding popup.
    var entry = state.markers.find(function (m) {
      return m.id === id;
    });
    if (entry) {
      entry.marker.openPopup();
    }
  }

  function render() {
    var city = getCity(state.cityId);
    if (!city) return;

    cityName.textContent = city.name;
    cityBlurb.textContent = city.blurb;

    // Filter beverages.
    var filtered = city.beverages
      .map(function (bev, idx) {
        return { bev: bev, id: beverageId(city, bev, idx) };
      })
      .filter(function (item) {
        return state.filter === "all" || item.bev.type === state.filter;
      });

    // Render list.
    listEl.innerHTML = "";
    if (filtered.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No " + state.filter + "s listed for this city.";
      listEl.appendChild(empty);
    } else {
      filtered.forEach(function (item) {
        listEl.appendChild(buildCard(item.bev, item.id));
      });
    }

    // Render map markers.
    clearMarkers();
    filtered.forEach(function (item) {
      var marker = L.marker(item.bev.coords, { icon: makeIcon(item.bev.type) })
        .addTo(map)
        .bindPopup(popupHTML(item.bev));
      marker.on("click", function () {
        setActive(item.id);
      });
      state.markers.push({ id: item.id, marker: marker, beverage: item.bev });
    });

    // Fit bounds.
    if (state.markers.length > 0) {
      var group = L.featureGroup(
        state.markers.map(function (m) {
          return m.marker;
        })
      );
      map.fitBounds(group.getBounds().pad(0.2));
    } else {
      map.setView(city.center, city.zoom);
    }
  }

  function buildCard(bev, id) {
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("data-id", id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    var head = document.createElement("div");
    head.className = "card-head";

    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    title.className = "card-title";
    title.innerHTML =
      '<span class="badge ' +
      bev.type +
      '">' +
      bev.type +
      "</span> " +
      escapeHtml(bev.name);
    var venue = document.createElement("div");
    venue.className = "venue";
    venue.textContent = bev.venue + " \u00B7 " + bev.address;
    titleWrap.appendChild(title);
    titleWrap.appendChild(venue);

    var rating = document.createElement("div");
    rating.className = "rating";
    rating.innerHTML =
      '<span class="stars" aria-label="' +
      bev.rating.toFixed(1) +
      ' out of 5">' +
      stars(bev.rating) +
      '</span> <span class="rating-num">' +
      bev.rating.toFixed(1) +
      "</span>";

    head.appendChild(titleWrap);
    head.appendChild(rating);

    var body = document.createElement("div");
    body.className = "card-body";
    body.textContent = bev.description;

    card.appendChild(head);
    card.appendChild(body);

    card.addEventListener("click", function () {
      setActive(id);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive(id);
      }
    });
    return card;
  }

  function setCity(id) {
    state.cityId = id;
    state.activeId = null;
    citySelect.value = id;
    render();
  }

  // Initial load.
  setCity(window.CITIES[0].id);

  // Invalidate map size after initial paint (handles flex layout).
  setTimeout(function () {
    map.invalidateSize();
  }, 50);
  window.addEventListener("resize", function () {
    map.invalidateSize();
  });
})();
