let map, rectangle;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.0522, lng: -118.2437 }, // Los Angeles default
    zoom: 10,
  });

  const drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
    drawingControl: true,
    rectangleOptions: {
      fillColor: "#ccc",
      fillOpacity: 0.3,
      strokeWeight: 2,
      clickable: false,
      editable: true,
      draggable: true,
    },
  });
  drawingManager.setMap(map);

  google.maps.event.addListener(drawingManager, "overlaycomplete", function (event) {
    if (rectangle) rectangle.setMap(null); // Remove previous
    rectangle = event.overlay;
  });
}

function searchBusinesses() {
  if (!rectangle) {
    alert("Please draw a rectangle on the map first.");
    return;
  }

  const bounds = rectangle.getBounds();
  const businessType = document.getElementById("businessType").value;

  const data = {
    business_type: businessType,
    bounds: {
      north: bounds.getNorthEast().lat(),
      south: bounds.getSouthWest().lat(),
      east: bounds.getNorthEast().lng(),
      west: bounds.getSouthWest().lng(),
    },
  };

  console.log("Sending to backend:", data);

  fetch("http://127.0.0.1:5000/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((response) => {
      if (!response.ok) throw new Error("Request failed.");
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "businesses.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Something went wrong. See console.");
    });
}

window.searchBusinesses = searchBusinesses;