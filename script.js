// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const coords = urlParams.get("coords")?.split(",").map(Number);
// const showLocation = urlParams.get("showLocation") === "true"; // No longer directly used

let userMarkers = []; // Array for manually dropped pins
let liveLocationMarker; // To hold the single marker that tracks live location
let watchId = null; // To store the ID returned by watchPosition, allowing us to stop tracking
let isTrackingLive = false; // State variable for live tracking

// Get references to UI elements (assuming these exist in your HTML)
const messageArea = document.getElementById("message-area");
const liveTrackingButton = document.getElementById("liveTrackingButton");

/**
 * Displays a temporary message on the map.
 * @param {string} message - The message to display.
 * @param {number} duration - How long the message should be visible in milliseconds.
 */
function displayMessage(message, duration = 3000) {
  messageArea.textContent = message;
  messageArea.classList.add("visible");
  setTimeout(() => {
    messageArea.classList.remove("visible");
  }, duration);
}

// Initialize Tile Layers
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

// Initialize Map
const map = L.map("map", {
  center: center,
  zoom: 13,
  layers: [Imagery], // Start with Imagery layer
  zoomControl: true, // Ensure zoom controls are visible
});

// Add layer control
const baseMaps = {
  OpenStreetMap: osm,
  Imagery: Imagery,
};
L.control.layers(baseMaps).addTo(map);

// Define a custom icon for dropped pins (used for initial pin and manually dropped pins)
const customPinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png", // Default Leaflet marker image
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41], // CUSTOMIZE THIS: [width, height] of the icon
  iconAnchor: [12, 41], // CUSTOMIZE THIS: point of the icon which will correspond to marker's location
  popupAnchor: [1, -34], // point from which the popup should open relative to the iconAnchor
  shadowSize: [41, 41], // size of the shadow
});

// Define a custom icon for the LIVE tracking marker (optional, but good for distinction)
const liveLocationIcon = L.icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Drop an initial pin if coordinates are provided in URL
if (coords && coords.length === 2) {
  const initialLat = coords[0];
  const initialLng = coords[1];
  const initialMarker = L.marker(coords, { icon: customPinIcon }).addTo(map);
  const initialPopupContent = `
        <div style="text-align: center; padding: 5px;">
            <b>Initial Pin</b><br style="margin-bottom: 5px;">
            Latitude: ${initialLat.toFixed(6)}<br>
            Longitude: ${initialLng.toFixed(6)}
        </div>
    `;
  initialMarker.bindPopup(initialPopupContent).openPopup();
}

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
        // const accuracy = position.coords.accuracy; // Simplified: removed accuracy circle

        const latLng = [lat, lng];

        if (!liveLocationMarker) {
          // Create the live tracking marker if it doesn't exist
          liveLocationMarker = L.marker(latLng, {
            icon: liveLocationIcon,
          }).addTo(map);
          liveLocationMarker.bindPopup(`You are here`).openPopup(); // Simple popup
          map.setView(latLng, 16); // Set map view on first fix
        } else {
          // Update the existing marker's position
          liveLocationMarker.setLatLng(latLng);
          // Update popup content if needed (optional for this simplified version)
          // liveLocationMarker.getPopup().setContent(`You are here<br>Accuracy: ${accuracy.toFixed(0)}m`);
        }

        // Always pan the map to keep the live marker centered
        map.panTo(latLng);

        // Send current live coordinates to parent iframe
        window.parent.postMessage({ lat, lng }, "*");
      },
      (error) => {
        console.error("Geolocation watch error:", error);
        let errorMessage = `Geolocation error for live tracking: ${error.message}.`;
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage +=
            " Please allow location access for this site in your browser settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage += " Your location could not be determined.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage += " Location request timed out.";
        }
        displayMessage(errorMessage, 8000); // Display for longer on error
        stopLiveLocationTracking(); // Stop watching on error
      },
      watchOptions
    );
    displayMessage("Live location tracking started.", 3000);
    isTrackingLive = true;
    liveTrackingButton.textContent = "Stop Live Tracking";
  } else {
    displayMessage(
      "Geolocation is not supported by your browser for live tracking.",
      5000
    );
    isTrackingLive = false;
    liveTrackingButton.textContent = "Start Live Tracking";
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
    displayMessage("Live location tracking stopped.", 3000);
    isTrackingLive = false;
    liveTrackingButton.textContent = "Start Live Tracking";
  }
}

/**
 * Toggles live location tracking on/off.
 */
function toggleLiveLocationTracking() {
  if (isTrackingLive) {
    stopLiveLocationTracking();
  } else {
    startLiveLocationTracking();
  }
}

// --- Functions for dropping a single pin manually (from your button) ---

/**
 * Drops a single, non-draggable, but deletable pin at the user's current location on button click.
 */
function dropPinAtCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const marker = L.marker([lat, lng], {
          draggable: false,
          icon: customPinIcon,
        }).addTo(map);

        const popupContent = `
                    <div style="text-align: center; padding: 5px;">
                        <b>Dropped Pin</b><br style="margin-bottom: 5px;">
                        Latitude: ${lat.toFixed(
                          6
                        )}<br style="margin-bottom: 5px;">
                        Longitude: ${lng.toFixed(
                          6
                        )}<br style="margin-bottom: 10px;">
                        <button style="padding: 5px 10px; border-radius: 5px; background-color: #f44336; color: white; border: none; cursor: pointer;"
                                onclick="removeMarker(${
                                  marker._leaflet_id
                                })">Delete</button>
                    </div>
                `;

        marker.bindPopup(popupContent).openPopup();
        userMarkers.push(marker); // Add to the array of user-dropped markers
        window.parent.postMessage({ lat, lng }, "*");
        displayMessage("Pin dropped at current location.", 3000);
      },
      (error) => {
        console.error("Geolocation error for dropping pin:", error);
        displayMessage("Unable to access your location to drop a pin.", 5000);
      }
    );
  } else {
    displayMessage("Geolocation is not supported by your browser.", 5000);
  }
}

/**
 * Removes a specific marker from the map and the userMarkers array.
 * This function needs to be globally accessible for the popup button's onclick.
 * @param {number} id - The Leaflet ID (_leaflet_id) of the marker to remove.
 */
window.removeMarker = function (id) {
  const marker = userMarkers.find((m) => m._leaflet_id === id);
  if (marker) {
    map.removeLayer(marker); // Remove the layer from the Leaflet map
    userMarkers = userMarkers.filter((m) => m._leaflet_id !== id); // Remove from array
    displayMessage(`Marker removed.`, 2000);
  }
};

// Start live tracking by default when map loads, but only if not already tracking (e.g., after refresh)
map.on("load", () => {
  if (!isTrackingLive) {
    startLiveLocationTracking();
  }
});
