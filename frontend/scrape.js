let map, rectangle;

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 34.0522, lng: -118.2437 },
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
  if (!rectangle) return alert("Draw a rectangle on the map first!");

  const bounds = rectangle.getBounds();
  const businessType = document.getElementById("businessType").value;

  const data = {
    business_type: businessType,
    bounds: {
      north: bounds.getNorthEast().lat(),
      south: bounds.getSouthWest().lat(),
      east: bounds.getNorthEast().lng(),
      west: bounds.getSouthWest().lng()
    }
  };

  fetch("https://your-flask-api-url.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  .then(response => response.blob())
  .then(blob => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "businesses.csv";
    link.click();
  });
}

window.initMap = initMap;