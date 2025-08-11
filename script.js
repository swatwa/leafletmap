const urlParams = new URLSearchParams(window.location.search);
const coords = urlParams.get("coords")?.split(",").map(Number);
const showLocation = urlParams.get("showLocation") === "true"; // This is now less relevant with auto-tracking

let userMarkers = []; // Existing array for manually dropped pins
let liveLocationMarker; // To hold the single marker that tracks live location
let watchId; // To store the ID returned by watchPosition, allowing us to stop tracking

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

// Drop a pin if initial coordinates are provided (original behavior, now correctly scoped)
if (coords && coords.length === 2) {
  const initialLat = coords[0];
  const initialLng = coords[1];
  const initialMarker = L.marker(coords).addTo(map);

  // Define popup content specifically for the initial pin
  const initialPopupContent = `
    <b>Initial Pin</b><br>
    Latitude: ${initialLat.toFixed(6)}<br>
    Longitude: ${initialLng.toFixed(6)}
  `;
  initialMarker.bindPopup(initialPopupContent).openPopup();
}

// REMOVED: The old centerMapOnCurrentLocation call here.
// Live tracking will handle initial centering.

// --- Functions for real-time location tracking ---

/**
 * Starts continuous real-time location tracking and updates a single marker on the map.
 */
function startLiveLocationTracking() {
  if (navigator.geolocation) {
    // Options for watchPosition to get the best accuracy
    const watchOptions = {
      enableHighAccuracy: true, // Use GPS if available for better accuracy
      timeout: 5000, // Maximum time (ms) allowed to return a position
      maximumAge: 0, // Force a fresh location (don't use a cached position)
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy; // Accuracy in meters

        const latLng = [lat, lng];

        if (!liveLocationMarker) {
          // If the live tracking marker doesn't exist, create it as a circle
          // The circle's radius indicates the accuracy
          liveLocationMarker = L.circle(latLng, {
            radius: accuracy, // Use accuracy for the circle radius
            color: "blue",
            fillColor: "#0078A8",
            fillOpacity: 0.5,
          }).addTo(map);

          // Bind a popup to show current location and accuracy
          liveLocationMarker
            .bindPopup(`You are here<br>Accuracy: ${accuracy.toFixed(0)}m`)
            .openPopup();

          // On first fix, set the map view to the current location and zoom in
          map.setView(latLng, 16);
        } else {
          // If the marker already exists, just update its position and radius
          liveLocationMarker.setLatLng(latLng);
          liveLocationMarker.setRadius(accuracy);
          liveLocationMarker
            .getPopup()
            .setContent(`You are here<br>Accuracy: ${accuracy.toFixed(0)}m`);
        }

        // Always pan the map to keep the live marker centered
        map.panTo(latLng);

        // Send current live coordinates to parent iframe
        window.parent.postMessage({ lat, lng }, "*");
      },
      (error) => {
        console.error("Geolocation watch error:", error);
        // Inform the user about the geolocation error
        // Using an alert here as per previous conversation, but a non-modal UI is better
        alert(
          `Geolocation error for live tracking: ${error.message}. Please ensure location services are enabled and allowed for this site.`
        );
        stopLiveLocationTracking(); // Stop watching on error
      },
      watchOptions
    );
    console.log("Live location tracking started.");
  } else {
    alert("Geolocation is not supported by your browser for live tracking.");
  }
}

/**
 * Stops real-time location tracking and removes the live location marker.
 */
function stopLiveLocationTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId); // Stop watching the position
    watchId = null; // Clear the watchId

    if (liveLocationMarker) {
      map.removeLayer(liveLocationMarker); // Remove the live marker from the map
      liveLocationMarker = null; // Clear the marker object
    }
    console.log("Live location tracking stopped.");
  }
}

// Start live location tracking automatically when the map is fully loaded
// This ensures the map object is ready before attempting to add/update layers
map.on("load", startLiveLocationTracking);

// --- Existing functions for dropping a single pin manually (from your button) ---

/**
 * Drops a single, draggable pin at the user's current location on button click.
 */
function dropPinAtCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        // Create popup content with lat/lng and delete button (correctly scoped here)
        const popupContent = `
          <b>Dropped Pin</b><br>
          Latitude: ${lat.toFixed(6)}<br>
          Longitude: ${lng.toFixed(6)}<br>
          <button onclick="removeMarker(${marker._leaflet_id})">Delete</button>
        `;

        marker.bindPopup(popupContent).openPopup();

        userMarkers.push(marker); // Add to the array of user-dropped markers

        window.parent.postMessage({ lat, lng }, "*");
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to access your location."); // This alert is for manual pin drops
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

/**
 * Removes a specific marker from the map and the userMarkers array.
 * @param {number} id - The Leaflet ID (_leaflet_id) of the marker to remove.
 */
function removeMarker(id) {
  const marker = userMarkers.find((m) => m._leaflet_id === id);
  if (marker) {
    map.removeLayer(marker); // Remove the layer from the Leaflet map
    userMarkers = userMarkers.filter((m) => m._leaflet_id !== id); // Remove from array
    console.log(`Marker with ID ${id} removed.`);
  }
}
