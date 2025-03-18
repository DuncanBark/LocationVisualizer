// Initialize the map centered on Boulder, CO
var map = L.map('map').setView([40.015, -105.2705], 13);

// Set initial tile layer (OpenStreetMap)
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Set satellite tile layer (Esri)
var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoIQ, and the GIS User Community'
});

// Toggle button to switch between OpenStreetMap and satellite view
var isSatellite = false;
document.getElementById('mapToggleButton').addEventListener('click', function() {
    if (isSatellite) {
        map.removeLayer(satelliteLayer);
        map.addLayer(osmLayer);
        this.innerText = "Satellite";
    } else {
        map.removeLayer(osmLayer);
        map.addLayer(satelliteLayer);
        this.innerText = "Street";
    }
    isSatellite = !isSatellite;
});

// Haversine formula to calculate distance between two points (in meters)
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Radius of Earth in meters
    const toRad = angle => angle * (Math.PI / 180);
    
    let dLat = toRad(lat2 - lat1);
    let dLng = toRad(lng2 - lng1);
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// File input event listener
let markers = []; // Store markers to update dynamically
let times = [];
let plot = 1;
document.getElementById('fileInput').addEventListener('change', function(event) {
    let file = event.target.files[0];

    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            try {
                let data = JSON.parse(e.target.result);
                console.log("Loaded JSON Data:", data);

                let lastLat = null, lastLng = null;
                let minDistance = 15; // Minimum distance in meters to add a new marker
                let maxDistance = 250000;

                // Loop through each segment and extract timelinePath points
                data.semanticSegments.forEach(segment => {        // Check if there is a visit and whether the activity type is "Flying"
                    if (segment.activity && segment.activity.topCandidate) {
                        if (segment.activity.topCandidate.type === "FLYING") {
                            plot = 0;
                        } else {
                            plot = 1;
                        }
                    }

                    if (segment.visit && segment.visit.topCandidate) {
                        if (segment.visit.topCandidate.semanticType === "UNKNOWN" && segment.visit.topCandidate.probability === 1.0) {
                            plot = 0;
                        } else {
                            plot = 1;
                        }
                    }

                    if (plot === 0 && segment.timelinePath) {
                        return;
                    }

                    if (segment.timelinePath) {
                        plot = 1;
                        segment.timelinePath.forEach(entry => {
                            try {
                                if (!entry.point) return;

                                let pointStr = entry.point.replace(/°/g, '').trim();
                                let coords = pointStr.split(',').map(coord => parseFloat(coord.trim()));

                                if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
                                    // console.warn("Skipping invalid coordinate:", entry.point);
                                    return;
                                }

                                let [lat, lng] = coords;
                                let time = entry.time || "Unknown Time";
                                times.push(time);

                                // Create marker with initial settings
                                let marker = L.circle([lat, lng], {
                                    color: document.getElementById('colorPicker').value,
                                    fillColor: document.getElementById('colorPicker').value,
                                    fillOpacity: parseFloat(document.getElementById('opacitySlider').value),
                                    // radius: parseInt(document.getElementById('sizeSlider').value)
                                    radius: 10
                                });

                                // Check distance from the last added point (too close or toofar)
                                if (lastLat !== null && lastLng !== null) {
                                    let distance = getDistance(lastLat, lastLng, lat, lng);
                                    if (distance < minDistance || distance >= maxDistance) {
                                        lastLat = lat;
                                        lastLng = lng;
                                        return;
                                    }
                                }

                                // ✅ Add only markers that are visible
                                marker.addTo(map).bindPopup(`
                                    <strong>Date & Time:</strong> ${new Date(time).toLocaleString()}<br>
                                    <strong>Latitude:</strong> ${lat}<br>
                                    <strong>Longitude:</strong> ${lng}
                                `);
                                markers.push(marker); // Store marker reference
                                lastLat = lat;
                                lastLng = lng;

                            } catch (error) {
                                console.warn("Skipping invalid entry:", entry, error);
                            }
                        });
                    }
                });

            } catch (error) {
                console.error("Error parsing JSON:", error);
                alert("Invalid JSON file.");
            }
            console.log(markers.length)
        };

        reader.readAsText(file);
    }
});





// Update markers dynamically when sliders change
document.getElementById('colorPicker').addEventListener('input', updateMarkers);
document.getElementById('opacitySlider').addEventListener('input', updateMarkers);
// document.getElementById('sizeSlider').addEventListener('input', updateMarkers);

function updateMarkers() {
    let newColor = document.getElementById('colorPicker').value;
    let newOpacity = parseFloat(document.getElementById('opacitySlider').value);
    // let newSize = parseInt(document.getElementById('sizeSlider').value);

    markers.forEach(function(marker, idx) {
        if (map.hasLayer(marker)) {  // ✅ Only update markers that are on the map
            marker.setStyle({
                color: newColor,
                fillColor: newColor,
                fillOpacity: newOpacity,
                opacity: newOpacity
            });
        }
    });
}
