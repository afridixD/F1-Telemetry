async function checkUser() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return window.location.href = '/login.html';
  const data = await res.json();
  if (data.user.role_name !== 'ShipmentOfficer' && data.user.role_name !== 'Admin') {
    window.location.href = '/login.html';
  }
  document.getElementById('userBadge').textContent = `Logistics: ${data.user.username}`;
}

function showNotif(msg, isError = false) {
  const notif = document.getElementById('notif');
  notif.className = `notification-banner ${isError ? 'error' : 'success'}`;
  notif.textContent = msg;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 4000);
}

async function loadShipments() {
  const res = await fetch('/api/shipments');
  const shipments = await res.json();

  const select = document.getElementById('item_shipment_id');
  select.innerHTML = shipments
    .filter(s => s.status !== 'Delivered')
    .map(s => `<option value="${s.shipment_id}">${s.tracking_code} (${s.status})</option>`)
    .join('');

  const tbody = document.querySelector('#shipmentsTable tbody');
  tbody.innerHTML = shipments.map(s => `
    <tr>
      <td><b>${s.tracking_code}</b></td>
      <td>${s.origin_location}</td>
      <td>${s.estimated_arrival_date ? new Date(s.estimated_arrival_date).toLocaleDateString() : 'N/A'}</td>
      <td>
        <span class="badge ${s.status === 'Delivered' ? 'badge-success' : (s.status === 'In Transit' ? 'badge-warning' : 'badge-info')}">
          ${s.status}
        </span>
      </td>
      <td>${s.dispatched_by_user || 'N/A'}</td>
      <td><b>${s.total_items}</b> parts</td>
      <td>
        ${s.status !== 'Delivered' 
          ? `<button class="btn" style="padding:2px 8px; font-size:0.8rem;" onclick="deliverShipment(${s.shipment_id})">Receive & Stock All</button>` 
          : '<span style="color:var(--text-muted)">Completed</span>'}
      </td>
    </tr>
  `).join('');
}

async function deliverShipment(id) {
  if (!confirm('Mark shipment Delivered? This executes an atomic transaction setting all enclosed parts to In Stock.')) return;
  const res = await fetch(`/api/shipments/${id}/deliver`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadShipments();
  } else {
    showNotif(data.error, true);
  }
}

document.getElementById('createShipmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/shipments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracking_code: document.getElementById('s_tracking').value,
      origin_location: document.getElementById('s_origin').value,
      estimated_arrival_date: document.getElementById('s_arrival').value || null
    })
  });
  const data = await res.json();
  if (res.ok) {
    showNotif('Consignment dispatched.');
    document.getElementById('createShipmentForm').reset();
    loadShipments();
  } else {
    showNotif(data.error, true);
  }
});

document.getElementById('addItemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const shipmentId = document.getElementById('item_shipment_id').value;
  const serial = document.getElementById('item_serial').value;

  const res = await fetch(`/api/shipments/${shipmentId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serial_number: serial })
  });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    document.getElementById('item_serial').value = '';
    loadShipments();
  } else {
    showNotif(data.error, true);
  }
});

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

checkUser();
loadShipments();