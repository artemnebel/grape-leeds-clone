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