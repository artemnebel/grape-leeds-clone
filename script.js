let map;
let service;
let markers = [];
let centerMarker = null;
let searchCircle = null;
let selectedCenter = null;
let infoWindow = null;
let currentMarker = null; // which marker's popup is open
let stripe = null;

// Track which places we've already shown (per search)
const seenPlaceIds = new Set();

// Results summary counts (per search)
let resultsCount = 0;
let noRealWebsiteCount = 0;

// Credits / trial
const CREDITS_KEY = "lf_credits";
const FREE_TRIAL_GRANTED_KEY = "lf_free_trial_granted";
let currentCredits = 0;

// ---------- Credits helpers ----------

function loadCreditsFromStorage() {
  let stored = parseInt(localStorage.getItem(CREDITS_KEY) || "0", 10);
  if (Number.isNaN(stored) || stored < 0) stored = 0;

  const trialGranted = localStorage.getItem(FREE_TRIAL_GRANTED_KEY) === "true";

  // Give 1 free scan only once per browser (not reset on refresh)
  if (!trialGranted) {
    stored += 1;
    localStorage.setItem(FREE_TRIAL_GRANTED_KEY, "true");
    localStorage.setItem(CREDITS_KEY, String(stored));
  }

  currentCredits = stored;
  updateCreditsUI();
}

function updateCreditsUI() {
  const label = document.getElementById("credits-label");
  if (label) {
    label.textContent = `Credits: ${currentCredits}`;
  }
  localStorage.setItem(CREDITS_KEY, String(currentCredits));
}

function consumeCredit() {
  if (currentCredits <= 0) return false;
  currentCredits -= 1;
  updateCreditsUI();
  return true;
}

// ---------- Results summary ----------

function milesToMeters(mi) {
  return mi * 1609.34;
}

function metersToMiles(m) {
  return m / 1609.34;
}

function updateRadiusLabel() {
  const el = document.getElementById("radius-value");
  if (!el || !searchCircle) return;
  const miles = metersToMiles(searchCircle.getRadius());
  el.textContent = `${miles.toFixed(1)} mi`;
}

function updateResultsSummary(statusText) {
  const el = document.getElementById("results-summary");
  if (!el) return;

  if (statusText) {
    el.textContent = statusText;
    return;
  }

  if (resultsCount === 0) {
    el.textContent = "No businesses found for this search.";
    return;
  }

  const leadPart =
    noRealWebsiteCount > 0
      ? ` • ${noRealWebsiteCount} with no real website`
      : "";

  el.textContent = `Found ${resultsCount} businesses${leadPart}.`;
}

// Offset helper

function offsetLatLng(latLng, dxMeters, dyMeters) {
  const earthRadius = 6378137; // meters
  const dLat = dyMeters / earthRadius;
  const dLng = dxMeters / (earthRadius * Math.cos((Math.PI * latLng.lat()) / 180));

  const newLat = latLng.lat() + (dLat * 180) / Math.PI;
  const newLng = latLng.lng() + (dLng * 180) / Math.PI;

  return new google.maps.LatLng(newLat, newLng);
}

// ---------- Website classification ----------

function classifyWebsite(url) {
  if (!url) {
    return { type: "none", label: "No website listed", isReal: false };
  }

  const lower = url.toLowerCase();

  const checks = [
    { domain: "facebook.com", type: "facebook", label: "Facebook page" },
    { domain: "fb.com", type: "facebook", label: "Facebook page" },
    { domain: "instagram.com", type: "instagram", label: "Instagram page" },
    { domain: "tiktok.com", type: "tiktok", label: "TikTok page" },
    { domain: "yelp.com", type: "yelp", label: "Yelp listing" },
    { domain: "tripadvisor.com", type: "tripadvisor", label: "Tripadvisor listing" },
    { domain: "grubhub.com", type: "grubhub", label: "Grubhub page" },
    { domain: "doordash.com", type: "doordash", label: "DoorDash page" },
    { domain: "ubereats.com", type: "ubereats", label: "UberEats page" },
    { domain: "seamless.com", type: "delivery", label: "Delivery site" },
    { domain: "postmates.com", type: "delivery", label: "Delivery site" },
    { domain: "opentable.com", type: "reservations", label: "Reservation page" },
    { domain: "toasttab.com", type: "ordering", label: "Ordering page" },
  ];

  for (const c of checks) {
    if (lower.includes(c.domain)) {
      return { type: c.type, label: c.label, isReal: false };
    }
  }

  // Anything else is likely their own "real" website
  return { type: "real", label: "Website", isReal: true };
}

function hasRealWebsite(url) {
  return classifyWebsite(url).isReal;
}

// ---------- Popup content ----------

function buildInfoContent(details) {
  const name = details.name || "Unknown business";
  const address =
    details.formatted_address || details.vicinity || "Address not available";

  const ratingVal = details.rating;
  const ratingText = ratingVal
    ? `${ratingVal.toFixed(1)} ★ (${details.user_ratings_total || 0} reviews)`
    : "No rating";

  const openNow =
    details.opening_hours && typeof details.opening_hours.open_now === "boolean"
      ? details.opening_hours.open_now
      : null;

  const openText =
    openNow === null
      ? ""
      : `<span style="color:${openNow ? "#16a34a" : "#dc2626"};">
           ${openNow ? "Open now" : "Closed now"}
         </span>`;

  const phone = details.formatted_phone_number;
  const phoneClean = phone ? phone.replace(/[^0-9+]/g, "") : null;
  const phoneLine = phone
    ? `<div style="margin-bottom:4px;"><strong>Phone:</strong> <a href="tel:${phoneClean}">${phone}</a></div>`
    : `<div style="margin-bottom:4px;"><strong>Phone:</strong> <span style="color:#f97316;">Not listed</span></div>`;

  const website = details.website;
  const websiteInfo = classifyWebsite(website);
  const websiteLine =
    websiteInfo.type === "none"
      ? `<div style="margin-bottom:2px;">
           <strong>Website:</strong>
           <span style="color:#dc2626;">No website listed</span>
         </div>`
      : `<div style="margin-bottom:2px;">
           <strong>${websiteInfo.label}:</strong>
           <a href="${website}" target="_blank" rel="noopener noreferrer">Open</a>
         </div>`;

  const mapsUrl = details.place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        name
      )}&query_place_id=${details.place_id}`
    : null;

  const titleHtml = mapsUrl
    ? `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
          style="color:#2563eb; font-weight:600; text-decoration:underline;">
          ${name}
       </a>`
    : `<span style="font-weight:600;">${name}</span>`;

  return `
    <div style="
      max-width:260px;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      background:#ffffff;
      color:#111827;
      padding:6px 4px;
    ">
      <div style="font-size:14px;margin-bottom:4px;">
        ${titleHtml}
      </div>
      <div style="font-size:12px;color:#374151;margin-bottom:4px;">
        ${address}
      </div>
      <div style="font-size:12px;margin-bottom:4px;">
        <strong>Rating:</strong> ${ratingText}
        ${openText ? " • " + openText : ""}
      </div>
      ${phoneLine}
      ${websiteLine}
    </div>
  `;
}

// ---------- Marker creation ----------

function createMarkerFromDetails(details) {
  if (!details.geometry || !details.geometry.location) return;

  const marker = new google.maps.Marker({
    map: map,
    position: details.geometry.location,
  });

  resultsCount += 1;
  if (!hasRealWebsite(details.website)) {
    noRealWebsiteCount += 1;
  }
  updateResultsSummary();

  if (window.LeadExporter) {
    window.LeadExporter.addLead(details);
  }

  function openInfo(fromClick = false) {
    if (!infoWindow) {
      infoWindow = new google.maps.InfoWindow();
    }

    if (fromClick && infoWindow.getMap() && currentMarker === marker) {
      infoWindow.close();
      currentMarker = null;
      return;
    }

    infoWindow.setContent(buildInfoContent(details));
    infoWindow.open(map, marker);
    currentMarker = marker;
  }

  marker.addListener("click", () => openInfo(true));

  markers.push(marker);
}

// ---------- Marker clearing ----------

function clearMarkers() {
  for (const m of markers) {
    m.setMap(null);
  }
  markers = [];
  seenPlaceIds.clear();
}

// ---------- Map init & circle ----------

function initMap() {
  console.log('initMap called');
  const defaultCenter = { lat: 40.7128, lng: -74.0060 };

  const mapElement = document.getElementById("map");
  console.log('Map element:', mapElement);

  if (!mapElement) {
    console.error('Map element not found!');
    return;
  }

  map = new google.maps.Map(mapElement, {
    center: defaultCenter,
    zoom: 12,
  });

  console.log('Map created:', map);

  infoWindow = new google.maps.InfoWindow();

  map.addListener("click", () => {
    if (infoWindow) {
      infoWindow.close();
      currentMarker = null;
    }
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setCenter(userLocation);
        map.setZoom(13);
        selectedCenter = userLocation;
        createOrUpdateCircle();
      },
      () => {
        selectedCenter = defaultCenter;
        createOrUpdateCircle();
      }
    );
  } else {
    selectedCenter = defaultCenter;
    createOrUpdateCircle();
  }

  service = new google.maps.places.PlacesService(map);

  map.addListener("click", (e) => {
    selectedCenter = e.latLng;
    createOrUpdateCircle();
  });
}

// Make initMap globally accessible for Google Maps callback
window.initMap = initMap;

function createOrUpdateCircle() {
  if (!selectedCenter || !map) return;

  const centerLatLng =
    selectedCenter instanceof google.maps.LatLng
      ? selectedCenter
      : new google.maps.LatLng(selectedCenter.lat, selectedCenter.lng);

  const defaultRadiusMeters = milesToMeters(3.0);
  const radiusMeters = searchCircle ? searchCircle.getRadius() : defaultRadiusMeters;

  if (!centerMarker) {
    centerMarker = new google.maps.Marker({
      map,
      position: centerLatLng,
      title: "Search center",
    });
  } else {
    centerMarker.setPosition(centerLatLng);
  }

  if (!searchCircle) {
    searchCircle = new google.maps.Circle({
      map,
      center: centerLatLng,
      radius: radiusMeters,
      strokeColor: "#2563eb",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: "#2563eb",
      fillOpacity: 0.15,
      editable: true,
      draggable: true,
    });

    searchCircle.addListener("radius_changed", () => {
      updateRadiusLabel();
    });

    searchCircle.addListener("center_changed", () => {
      selectedCenter = searchCircle.getCenter();
      if (centerMarker) {
        centerMarker.setPosition(selectedCenter);
      }
    });
  } else {
    searchCircle.setCenter(centerLatLng);
    searchCircle.setRadius(radiusMeters);
  }

  updateRadiusLabel();
}

// ---------- Places search ----------

function runNearbySearch(centerLatLng, radiusMeters, keyword, filters) {
  const request = {
    location: centerLatLng,
    radius: String(radiusMeters),
    keyword: keyword,
  };

  service.nearbySearch(request, (results, status) => {
    if (status !== "OK" || !results || results.length === 0) {
      updateResultsSummary("No results returned from Google Places.");
      return;
    }

    results.forEach((place) => {
      if (filters.minRating > 0 && place.rating && place.rating < filters.minRating) {
        return;
      }

      if (!place.place_id || seenPlaceIds.has(place.place_id)) {
        return;
      }
      seenPlaceIds.add(place.place_id);

      service.getDetails(
        {
          placeId: place.place_id,
          fields: [
            "name",
            "formatted_address",
            "formatted_phone_number",
            "website",
            "rating",
            "user_ratings_total",
            "opening_hours",
            "geometry",
            "place_id",
            "vicinity",
          ],
        },
        (details, detailsStatus) => {
          if (detailsStatus !== "OK" || !details) return;

          if (filters.mustHavePhone && !details.formatted_phone_number) {
            return;
          }

          if (filters.onlyNoWebsite && hasRealWebsite(details.website)) {
            return;
          }

          createMarkerFromDetails(details);
        }
      );
    });
  });
}

// ---------- Stripe checkout helper ----------

async function startCheckout() {
  const buyBtn = document.getElementById("buy-credits-btn");
  if (!stripe) {
    alert("Stripe is not initialized.");
    return;
  }
  try {
    if (buyBtn) {
      buyBtn.disabled = true;
      buyBtn.textContent = "Redirecting...";
    }

    const res = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
    });

    const data = await res.json();
    if (!data.sessionId) {
      alert("Unable to start checkout.");
      return;
    }

    const { error } = await stripe.redirectToCheckout({
      sessionId: data.sessionId,
    });
    if (error) {
      alert(error.message || "Checkout failed.");
    }
  } catch (err) {
    console.error(err);
    alert("Error starting checkout.");
  } finally {
    if (buyBtn) {
      buyBtn.disabled = false;
      buyBtn.textContent = "Buy 5 scans – $10";
    }
  }
}

// ---------- DOM wiring ----------

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Stripe (replace with your publishable key)
  stripe = Stripe("pk_live_51QMlanR3Sx8fW7tugxWjTIuMH9yTvxBMm8qvBmcZckZgCwhFTcaRskzBl6vhwJ6VPhYb8xj58FIWF4MXG46fpWMF00jfF8vBqpE");

  loadCreditsFromStorage();

  // If coming back from a successful checkout (?checkout=success), add 5 credits
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "success") {
    currentCredits += 5;
    updateCreditsUI();
    // Clean the URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const buyBtn = document.getElementById("buy-credits-btn");
  if (buyBtn) {
    buyBtn.addEventListener("click", startCheckout);
  }

  const searchBtn = document.getElementById("search-btn");
  const categoryInput = document.getElementById("category-input");
  const filterPhoneCheckbox = document.getElementById("filter-phone");
  const filterRatingSelect = document.getElementById("filter-rating");
  const filterNoWebsiteCheckbox = document.getElementById("filter-no-website");

  searchBtn.addEventListener("click", () => {
    if (currentCredits <= 0) {
      alert("You are out of scans. Buy more credits to continue.");
      return;
    }

    const keyword = categoryInput.value.trim();
    if (!keyword) {
      alert("Please enter a business category (e.g. plumbers, restaurants).");
      return;
    }

    if (!searchCircle) {
      alert("Click on the map to choose a search area first.");
      return;
    }

    const centerLatLng = searchCircle.getCenter();
    let radiusMeters = searchCircle.getRadius();

    const MAX_RADIUS = 50000;
    if (radiusMeters > MAX_RADIUS) {
      radiusMeters = MAX_RADIUS;
      alert("Google's Places API max radius is 50 km. Using 50 km for the search.");
    }

    const filters = {
      mustHavePhone: filterPhoneCheckbox.checked,
      minRating: parseFloat(filterRatingSelect.value) || 0,
      onlyNoWebsite: filterNoWebsiteCheckbox.checked,
    };

    // Consume one credit per search
    if (!consumeCredit()) {
      alert("You are out of scans. Buy more credits to continue.");
      return;
    }

    clearMarkers();
    resultsCount = 0;
    noRealWebsiteCount = 0;
    updateResultsSummary("Searching...");
    if (window.LeadExporter) {
      window.LeadExporter.clearLeads();
    }

    runNearbySearch(centerLatLng, radiusMeters, keyword, filters);
  });

  categoryInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      searchBtn.click();
    }
  });
});
