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

const map = L.map("map", {
  center: [47.2529, -122.4443],
  zoom: 9,
  layers: [Imagery], // default layer
});

const baseMaps = {
  OpenStreetMap: osm,
  Imagery: Imagery,
};

L.control.layers(baseMaps).addTo(map);
