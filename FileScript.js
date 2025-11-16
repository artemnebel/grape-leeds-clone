// FileScript.js
// Handles storing lead data and exporting CSV (clean format)

window.LeadExporter = (function () {
  // idKey -> lead object (idKey is placeId when available, else name+address)
  const leadsById = new Map();

  function makeIdKey(details) {
    const placeId = details.place_id || "";
    if (placeId) return placeId;

    const name = (details.name || "").trim();
    const address =
      (details.formatted_address || details.vicinity || "").trim();
    return `${name}::${address}` || String(Math.random());
  }

  function normalizeDetails(details) {
    const name = details.name || "";
    const address = details.formatted_address || details.vicinity || "";
    const phone = details.formatted_phone_number || "";
    const rating =
      details.rating != null && details.rating !== ""
        ? String(details.rating)
        : "";
    const reviews =
      details.user_ratings_total != null
        ? String(details.user_ratings_total)
        : "";

    // Shorter Google Maps URL: just a text search on name + address
    const query = [name, address].filter(Boolean).join(" ");
    const mapsUrl = query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          query
        )}`
      : "";

    const idKey = makeIdKey(details);

    return { idKey, name, address, phone, rating, reviews, mapsUrl };
  }

  function addLead(details) {
    const lead = normalizeDetails(details);
    if (!lead.idKey) return;
    leadsById.set(lead.idKey, lead);
  }

  function clearLeads() {
    leadsById.clear();
  }

  function csvEscape(value) {
    if (value == null) return "";
    const s = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (/[" ,\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCsv() {
    // New header: NO place id, NO website
    const header = [
      "Name",
      "Address",
      "Phone",
      "Rating",
      "Reviews",
      "Google Maps",
    ];
    const rows = [header.join(",")];

    for (const lead of leadsById.values()) {
      // Excel/Sheets hyperlink formula so the cell just shows "Maps"
      const mapsFormula = lead.mapsUrl
        ? `=HYPERLINK("${lead.mapsUrl}","Maps")`
        : "";

      const vals = [
        lead.name,
        lead.address,
        lead.phone,
        lead.rating,
        lead.reviews,
        mapsFormula,
      ].map(csvEscape);

      rows.push(vals.join(","));
    }

    return rows.join("\r\n");
  }

  function downloadCsv(filename = "leads.csv") {
    if (leadsById.size === 0) {
      alert("No leads to export yet. Run a search first.");
      return;
    }

    const csv = buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Wire up button when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    const downloadBtn = document.getElementById("download-csv-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadCsv());
    }
  });

  return {
    addLead,
    clearLeads,
    downloadCsv,
  };
})();
