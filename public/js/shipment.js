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
  if (!notif) return;
  notif.className = `notification-banner ${isError ? 'error' : 'success'}`;
  notif.textContent = msg;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 4000);
}

async function loadShipments() {
  try {
    const [shipRes, partRes] = await Promise.all([
      fetch('/api/shipments'),
      fetch('/api/parts')
    ]);
    const shipments = await shipRes.json();
    const parts = await partRes.json();

    const select = document.getElementById('item_shipment_id');
    if (select) {
      select.innerHTML = shipments
        .filter(s => s.status !== 'Delivered')
        .map(s => `<option value="${s.shipment_id}">${s.tracking_code} (${s.status})</option>`)
        .join('');
    }

    const partSelect = document.getElementById('item_serial');
    if (partSelect) {
      const availableParts = parts.filter(p => p.current_status === 'In Stock');
      partSelect.innerHTML = availableParts.length === 0
        ? '<option value="">No In-Stock Parts Available</option>'
        : availableParts.map(p => `<option value="${p.serial_number}">${p.serial_number} (${p.category_name})</option>`).join('');
    }

    const tbody = document.querySelector('#shipmentsTable tbody');
    if (tbody) {
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
  } catch (err) {
    console.error('Error loading shipments:', err);
  }
}

async function loadRequisitions() {
  try {
    const res = await fetch('/api/parts/cross/requisitions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();

    const tbody = document.querySelector('#requisitionsTable tbody');
    if (!tbody) return;

    if (!Array.isArray(items) || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 18px;">
            All garage components are nominal. No replenishment orders required.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(r => `
      <tr>
        <td><b>${r.serial_number}</b></td>
        <td>${r.category_name}</td>
        <td>${r.supplier_name} <br><small style="color:var(--text-muted);">${r.contact_email || 'N/A'}</small></td>
        <td>
          <span class="badge ${r.current_status === 'Failed' ? 'badge-danger' : 'badge-warning'}">
            ${r.current_status}
          </span>
        </td>
        <td><b>${Number(r.wear_percentage).toFixed(1)}%</b></td>
        <td>
          <span class="badge ${r.requisition_priority && r.requisition_priority.startsWith('CRITICAL') ? 'badge-danger' : 'badge-warning'}">
            ${r.requisition_priority}
          </span>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading requisitions:', err);
  }
}

async function deliverShipment(id) {
  if (!confirm('Mark shipment Delivered? This executes an atomic transaction setting all enclosed parts to In Stock.')) return;
  const res = await fetch(`/api/shipments/${id}/deliver`, { method: 'POST' });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadShipments();
    loadRequisitions();
  } else {
    showNotif(data.error, true);
  }
}

const createForm = document.getElementById('createShipmentForm');
if (createForm) {
  createForm.addEventListener('submit', async (e) => {
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
      createForm.reset();
      loadShipments();
      loadRequisitions();
    } else {
      showNotif(data.error, true);
    }
  });
}

const addForm = document.getElementById('addItemForm');
if (addForm) {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shipmentId = document.getElementById('item_shipment_id').value;
    const serial = document.getElementById('item_serial').value;

    if (!serial) {
      showNotif('Please select a valid part.', true);
      return;
    }

    const res = await fetch(`/api/shipments/${shipmentId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial_number: serial })
    });
    const data = await res.json();
    if (res.ok) {
      showNotif(data.message);
      loadShipments();
      loadRequisitions();
    } else {
      showNotif(data.error, true);
    }
  });
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

checkUser();
loadShipments();
loadRequisitions();