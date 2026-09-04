async function checkUser() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return window.location.href = '/login.html';
  const data = await res.json();
  if (data.user.role_name !== 'Engineer' && data.user.role_name !== 'Admin') {
    window.location.href = '/login.html';
  }
  document.getElementById('userBadge').textContent = `Engineer: ${data.user.username}`;
}

function showNotif(msg, isError = false) {
  const notif = document.getElementById('notif');
  notif.className = `notification-banner ${isError ? 'error' : 'success'}`;
  notif.textContent = msg;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 4000);
}

async function loadDropdowns() {
  const [catRes, supRes] = await Promise.all([
    fetch('/api/parts/meta/categories'),
    fetch('/api/parts/meta/suppliers')
  ]);
  const categories = await catRes.json();
  const suppliers = await supRes.json();

  const catSelect = document.getElementById('p_category');
  catSelect.innerHTML = categories.map(c => `<option value="${c.category_id}">${c.category_name}</option>`).join('');

  const supSelect = document.getElementById('p_supplier');
  supSelect.innerHTML = suppliers.map(s => `<option value="${s.supplier_id}">${s.supplier_name}</option>`).join('');
}

async function loadSummaries() {
  const res = await fetch('/api/parts/summary');
  const data = await res.json();

  const cardsContainer = document.getElementById('summaryCards');
  cardsContainer.innerHTML = data.statusSummary.map(s => `
    <div style="background:var(--bg-input); padding:8px 12px; border-radius:4px; border:1px solid var(--border);">
      <div style="color:var(--text-muted); font-size:0.75rem;">${s.current_status}</div>
      <div style="font-size:1.2rem; font-weight:700;">${s.count}</div>
    </div>
  `).join('');

  const tableBody = document.querySelector('#categorySummaryTable tbody');
  tableBody.innerHTML = data.categorySummary.map(c => `
    <tr>
      <td>${c.category_name}</td>
      <td>${c.total_parts}</td>
      <td>${Number(c.avg_wear || 0).toFixed(1)}%</td>
    </tr>
  `).join('');
}

async function loadParts() {
  const res = await fetch('/api/parts');
  const parts = await res.json();

  const tbody = document.querySelector('#partsTable tbody');
  tbody.innerHTML = parts.map(p => {
    const isCritical = Number(p.wear_percentage) >= 80.0;
    return `
      <tr>
        <td><b>${p.serial_number}</b></td>
        <td>${p.category_name}</td>
        <td>${p.supplier_name}</td>
        <td><span class="badge ${p.current_status === 'In Stock' ? 'badge-success' : 'badge-info'}">${p.current_status}</span></td>
        <td>${p.total_mileage_km} km</td>
        <td>${p.wear_percentage}%</td>
        <td>${isCritical ? '<span class="badge badge-danger">Replace Soon</span>' : '<span class="badge badge-success">Nominal</span>'}</td>
        <td>
          <button class="btn-logout" onclick="deletePart('${p.serial_number}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadCrossDepartmentData() {
  const res = await fetch('/api/parts/cross/pipeline');
  const data = await res.json();

  // 1. Render Mechanics Live Garage Work
  const garageBody = document.querySelector('#engineerGarageTable tbody');
  if (garageBody) {
    garageBody.innerHTML = data.garageWork.length === 0
      ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No active chassis setups.</td></tr>'
      : data.garageWork.map(g => `
        <tr>
          <td><b>${g.serial_number}</b> <br><small style="color:var(--text-muted);">${g.category_name}</small></td>
          <td><b>${g.chassis_code}</b></td>
          <td>${g.driver_name}</td>
          <td>${g.mechanic_name}</td>
          <td>${g.wear_percentage}%</td>
        </tr>
      `).join('');
  }

  // 2. Render Inbound Logistics Pipeline
  const freightBody = document.querySelector('#engineerFreightTable tbody');
  if (freightBody) {
    freightBody.innerHTML = data.inboundFreight.length === 0
      ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No inbound shipments in transit.</td></tr>'
      : data.inboundFreight.map(f => `
        <tr>
          <td><b>${f.serial_number}</b> <br><small style="color:var(--text-muted);">${f.category_name}</small></td>
          <td>${f.tracking_code}</td>
          <td>${f.origin_location}</td>
          <td>${f.estimated_arrival_date ? new Date(f.estimated_arrival_date).toLocaleDateString() : 'TBD'}</td>
          <td><span class="badge ${f.status === 'In Transit' ? 'badge-warning' : 'badge-info'}">${f.status}</span></td>
        </tr>
      `).join('');
  }
}

async function deletePart(serial) {
  if (!confirm(`Delete part ${serial}?`)) return;
  const res = await fetch(`/api/parts/${serial}`, { method: 'DELETE' });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadParts();
    loadSummaries();
    loadCrossDepartmentData();
  } else {
    showNotif(data.error, true);
  }
}

document.getElementById('createPartForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    serial_number: document.getElementById('p_serial').value,
    category_id: document.getElementById('p_category').value,
    supplier_id: document.getElementById('p_supplier').value,
    current_status: document.getElementById('p_status').value
  };

  const res = await fetch('/api/parts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (res.ok) {
    showNotif('Part registered successfully.');
    document.getElementById('createPartForm').reset();
    loadParts();
    loadSummaries();
    loadCrossDepartmentData();
  } else {
    showNotif(data.error, true);
  }
});

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

checkUser();
loadDropdowns();
loadSummaries();
loadParts();
loadCrossDepartmentData();