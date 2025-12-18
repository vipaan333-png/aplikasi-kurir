
// -- CONFIGURATION --
// REPLACE THIS WITH YOUR REAL SUPABASE KEY
const SUPABASE_URL = 'https://emahfjuzmstrvsvtglry.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtYWhmanV6bXN0cnZzdnRnbHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4OTg4NDgsImV4cCI6MjA4MDQ3NDg0OH0.-8t87OFqxMsIZvwsXSJnOA5lhCqHVOaDoIcrVW6kbQ0'; // <--- PASTE FULL KEY HERE

// Initialize Supabase
// Global 'supabase' object provided by CDN script
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// -- APP STATE --
let currentPosition = null;
let map = null;
let markers = [];
let routeLine = null;
let outletsCache = [];

// -- INITIALIZATION --
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initMap();
    initDate();
    loadOutlets();
    loadHistory();

    // Listen for form submission
    document.getElementById('delivery-form').addEventListener('submit', handleDeliverySubmit);

    // Listen for outlet selection in form
    document.getElementById('pilih_outlet').addEventListener('change', calculateDistance);
});

// -- NAVIGATION --
function initNav() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active classes
            navItems.forEach(n => n.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Add active class to clicked item and target view
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            // Refresh map if switching to home or outlet view
            if (targetId === 'home' || targetId === 'outlets') {
                setTimeout(() => { if (map) map.invalidateSize(); }, 300);
            }
        });
    });
}

function initDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tgl_pengantaran').value = today;
}

// -- MAP & GEOLOCATION --
function initMap() {
    // Default to Jakarta
    map = L.map('map').setView([-6.2088, 106.8456], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Get User Location
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                currentPosition = { lat: latitude, lng: longitude };

                updateUserMarker(latitude, longitude);
                document.getElementById('location-status').textContent = 'Lokasi Terdeteksi';
                document.getElementById('location-status').style.color = 'green';

                // If user is selecting an outlet, recalc distance dynamically
                if (document.getElementById('pilih_outlet').value) {
                    calculateDistance();
                }
            },
            (error) => {
                console.error("Error GPS:", error);
                document.getElementById('location-status').textContent = 'Gagal mendeteksi lokasi (Pastikan GPS aktif)';
                document.getElementById('location-status').style.color = 'red';
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Browser Anda tidak mendukung Geolocation.");
    }
}

let userMarker = null;
function updateUserMarker(lat, lng) {
    if (userMarker) {
        userMarker.setLatLng([lat, lng]);
    } else {
        const courierIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063823.png', // Motorbike Icon
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        userMarker = L.marker([lat, lng], { icon: courierIcon })
            .addTo(map)
            .bindPopup("Posisi Anda")
            .openPopup();

        map.panTo([lat, lng]);
    }
}

// -- DATA OPERATIONS --

async function loadOutlets() {
    const listContainer = document.getElementById('outlet-list');
    const selectBox = document.getElementById('pilih_outlet');

    listContainer.innerHTML = '<div class="loading-spinner">Mengambil data...</div>';

    // Fetch from Supabase
    const { data: outlets, error } = await db
        .from('outlet')
        .select('*');

    if (error) {
        console.error("Supabase Error:", error);
        listContainer.innerHTML = '<p class="error">Gagal memuat outlet.</p>';
        return;
    }

    outletsCache = outlets; // Save for distance calc
    listContainer.innerHTML = ''; // Clear loading
    selectBox.innerHTML = '<option value="">-- Pilih Outlet --</option>'; // Reset select

    // Clear existing map markers (except user)
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    if (outlets.length === 0) {
        listContainer.innerHTML = '<p>Belum ada data outlet.</p>';
        return;
    }

    outlets.forEach(outlet => {
        // 1. Render List Item
        const itemDiv = document.createElement('div');
        itemDiv.className = 'outlet-item';
        itemDiv.innerHTML = `
            <div class="outlet-info">
                <h3>${outlet.nama_outlet}</h3>
                <p><i class="fa-solid fa-location-dot"></i> ${outlet.alamat}</p>
                <p><i class="fa-solid fa-phone"></i> ${outlet.no_telpon || '-'}</p>
            </div>
            <div class="outlet-actions">
                <a href="tel:${outlet.no_telpon}" class="action-btn btn-call">
                    <i class="fa-solid fa-phone"></i>
                </a>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${outlet.latitude},${outlet.longitude}" target="_blank" class="action-btn btn-map">
                    <i class="fa-solid fa-diamond-turn-right"></i>
                </a>
            </div>
        `;
        listContainer.appendChild(itemDiv);

        // 2. Add to Select Box
        const option = document.createElement('option');
        option.value = outlet.id;
        option.textContent = outlet.nama_outlet;
        selectBox.appendChild(option);

        // 3. Add Map Marker
        const marker = L.marker([outlet.latitude, outlet.longitude])
            .addTo(map)
            .bindPopup(`<b>${outlet.nama_outlet}</b><br>${outlet.alamat}`);
        markers.push(marker);
    });
}

function calculateDistance() {
    const outletId = document.getElementById('pilih_outlet').value;
    const distanceBox = document.getElementById('distance-box');
    const displayElement = document.getElementById('jarak_display');
    const inputElement = document.getElementById('jarak_km');

    if (!outletId || !currentPosition) {
        distanceBox.style.display = 'none';
        if (routeLine) map.removeLayer(routeLine);
        return;
    }

    // Find target outlet
    const target = outletsCache.find(o => o.id === outletId);
    if (!target) return;

    // Haversine Formula calculation
    const dist = getDistanceFromLatLonInKm(
        currentPosition.lat, currentPosition.lng,
        target.latitude, target.longitude
    );

    // Update UI
    distanceBox.style.display = 'block';
    displayElement.textContent = dist.toFixed(2) + " KM";
    inputElement.value = dist.toFixed(2);

    // Draw Line on Map
    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline([
        [currentPosition.lat, currentPosition.lng],
        [target.latitude, target.longitude]
    ], { color: 'blue', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(map);

    // Adjust map bounds to show both
    const bounds = L.latLngBounds(
        [currentPosition.lat, currentPosition.lng],
        [target.latitude, target.longitude]
    );
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Haversine Formula Helper
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

// -- FORM SUBMIT --
async function handleDeliverySubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    submitBtn.disabled = true;

    const formData = {
        tanggal: document.getElementById('tgl_pengantaran').value,
        nama_kurir: document.getElementById('nama_kurir').value,
        no_faktur: document.getElementById('no_faktur').value,
        outlet_id: document.getElementById('pilih_outlet').value,
        jarak_km: parseFloat(document.getElementById('jarak_km').value) || 0,
        catatan: document.getElementById('catatan').value,
        status: 'Pending'
    };

    const { data, error } = await db
        .from('pengantaran')
        .insert([formData]);

    if (error) {
        alert('Gagal menyimpan pengantaran: ' + error.message);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    } else {
        alert('Data Pengantaran Berhasil Disimpan!');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        e.target.reset();
        document.getElementById('distance-box').style.display = 'none';
        if (routeLine) map.removeLayer(routeLine);
        initDate(); // Reset date to today
        loadHistory(); // Refresh history

        // Go to history tab
        document.querySelector('[data-target="history"]').click();
    }
}

async function loadHistory() {
    const container = document.getElementById('history-list');

    const { data, error } = await db
        .from('pengantaran')
        .select(`
            *,
            outlet (nama_outlet)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    container.innerHTML = '';

    // Update Stats on Home
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = data.filter(d => d.tanggal === todayStr).length;
    const completedCount = data.filter(d => d.status === 'Selesai').length;

    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('completed-count').textContent = completedCount;

    if (data.length === 0) {
        container.innerHTML = '<p>Belum ada riwayat pengantaran.</p>';
        return;
    }

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                <strong>${item.no_faktur}</strong>
                <span class="status-${item.status.toLowerCase()}">${item.status}</span>
            </div>
            <p><i class="fa-solid fa-store"></i> ${item.outlet ? item.outlet.nama_outlet : 'Outlet Dihapus'}</p>
            <p><i class="fa-solid fa-calendar"></i> ${item.tanggal}</p>
            <p style="font-size:0.8rem; color:#888;">Kurir: ${item.nama_kurir} | Jarak: ${item.jarak_km} KM</p>
        `;
        container.appendChild(div);
    });
}

// End of App Logic
