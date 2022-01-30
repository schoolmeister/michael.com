require("./imports.js");

let ICON = L.icon({
  iconUrl: require("./images/onion-red-32x32.png"),
  iconSize: [40, 40],
});

function setupMap() {
  var map = L.map("map").setView([51.049999, 3.733333], 19);
  L.tileLayer(
    "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2Nob29sbWVpc3RlciIsImEiOiJja3owY2F3d3kxYW85MzBteHN2aXZzOHl1In0.GdKYPEWxWqqsHornbQvUVg",
    {
      attribution:
        'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
      maxZoom: 18,
      id: "mapbox/streets-v11",
      tileSize: 512,
      zoomOffset: -1,
      accessToken:
        "pk.eyJ1Ijoic2Nob29sbWVpc3RlciIsImEiOiJja3owY2F3d3kxYW85MzBteHN2aXZzOHl1In0.GdKYPEWxWqqsHornbQvUVg",
    }
  ).addTo(map);
  storesLayer = L.geoJSON(stores, {
    pointToLayer: function (feature, latlng) {
      return L.marker(latlng, { icon: ICON });
    },
  });
  L.markerClusterGroup({
    disableClusteringAtZoom: 13,
    spiderfyOnMaxZoom: false,
  })
    .addLayer(storesLayer)
    .addTo(map);

  let lc = L.control.locate().addTo(map);
  lc.start();
  return map;
}

const map = setupMap();
