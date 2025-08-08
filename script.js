const urlParams = new URLSearchParams(window.location.search);
const coords = urlParams.get("coords")?.split(",").map(Number);
const showLocation = urlParams.get("showLocation") === "true";

let userMarkers = [];
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
});

const Imagery = L.tileLayer(
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  }
);

// Default center
let center = [47.2529, -122.4443];
if (coords && coords.length === 2) {
  center = coords;
}

const map = L.map("map", {
  center: center,
  zoom: 13,
  layers: [Imagery],
});

const baseMaps = {
  OpenStreetMap: osm,
  Imagery: Imagery,
};

L.control.layers(baseMaps).addTo(map);

// Drop a pin if coordinates are provided
if (coords && coords.length === 2) {
  L.marker(coords).addTo(map).bindPopup("You are here").openPopup();
}

// Function to center the map on the user's current location
function centerMapOnCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], 13);
      },
      (error) => {
        console.error("Geolocation error:", error);
      }
    );
  }
}

// Call the new function when the map loads
centerMapOnCurrentLocation();

// Function to drop a pin at the user's current location
function dropPinAtCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        // Create popup content with lat/lng and delete button
        const popupContent = `
          <b>Dropped Pin</b><br>
          Latitude: ${lat.toFixed(6)}<br>
          Longitude: ${lng.toFixed(6)}<br>
          <button onclick="removeMarker(${marker._leaflet_id})">Delete</button>
        `;

        marker.bindPopup(popupContent).openPopup();

        userMarkers.push(marker);

        window.parent.postMessage({ lat, lng }, "*");
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to access your location.");
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

function removeMarker(id) {
  const marker = userMarkers.find((m) => m._leaflet_id === id);
  if (marker) {
    map.removeLayer(marker);
    userMarkers = userMarkers.filter((m) => m._leaflet_id !== id);
  }
}
