async function checkUser() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return window.location.href = '/login.html';
  const data = await res.json();
  if (data.user.role_name !== 'Mechanic' && data.user.role_name !== 'Admin') {
    window.location.href = '/login.html';
  }
  document.getElementById('userBadge').textContent = `Mechanic: ${data.user.username}`;
}

function showNotif(msg, isError = false) {
  const notif = document.getElementById('notif');
  notif.className = `notification-banner ${isError ? 'error' : 'success'}`;
  notif.textContent = msg;
  notif.style.display = 'block';
  setTimeout(() => notif.style.display = 'none', 4000);
}

async function loadCarsAndParts() {
  const [carsRes, partsRes] = await Promise.all([
    fetch('/api/assignments/cars'),
    fetch('/api/parts')
  ]);
  const cars = await carsRes.json();
  const parts = await partsRes.json();

  const carSelect = document.getElementById('fit_car_id');
  carSelect.innerHTML = cars.map(c => `<option value="${c.car_id}">${c.chassis_code} (${c.driver_name})</option>`).join('');

  const stockParts = parts.filter(p => p.current_status === 'In Stock');
  const partSelect = document.getElementById('fit_serial');
  partSelect.innerHTML = stockParts.map(p => `<option value="${p.serial_number}">${p.serial_number} - ${p.category_name} (${p.wear_percentage}% wear)</option>`).join('');

  const container = document.getElementById('carsList');
  container.innerHTML = cars.map(car => `
    <div style="background:var(--bg-input); padding:1rem; border-radius:4px; margin-bottom:1rem; border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <b>Chassis: ${car.chassis_code}</b>
        <span style="color:var(--text-muted)">Driver: ${car.driver_name}</span>
      </div>
      <table style="font-size:0.85rem;">
        <thead>
          <tr><th>Part</th><th>Category</th><th>Fitted At</th><th>Wear</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${car.active_parts.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No components fitted.</td></tr>' : ''}
          ${car.active_parts.map(p => `
            <tr>
              <td><b>${p.serial_number}</b></td>
              <td>${p.category_name}</td>
              <td>${new Date(p.fitted_at).toLocaleString()}</td>
              <td>${p.wear_percentage}%</td>
              <td><button class="btn-logout" onclick="removePart(${p.assignment_id})">Unmount</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

async function removePart(assignment_id) {
  const km = prompt('Enter additional mileage covered (km):', '150');
  const wear = prompt('Enter additional wear accrued (%):', '5');
  if (km === null || wear === null) return;

  const res = await fetch('/api/assignments/remove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignment_id, additional_mileage: km, added_wear: wear })
  });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadCarsAndParts();
  } else {
    showNotif(data.error, true);
  }
}

async function loadFailures() {
  const res = await fetch('/api/failures?resolved=false');
  const failures = await res.json();

  const tbody = document.querySelector('#failuresTable tbody');
  tbody.innerHTML = failures.length === 0 
    ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No active failures logged.</td></tr>'
    : failures.map(f => `
      <tr>
        <td><b>${f.serial_number}</b></td>
        <td>${f.category_name}</td>
        <td><span class="badge ${f.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${f.severity}</span></td>
        <td>${f.reported_by_user}</td>
        <td>${f.failure_reason}</td>
        <td><button class="btn" style="padding:2px 8px; font-size:0.8rem;" onclick="resolveFailure(${f.failure_id})">Mark Resolved</button></td>
      </tr>
    `).join('');
}

async function resolveFailure(id) {
  const res = await fetch(`/api/failures/${id}/resolve`, { method: 'PUT' });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadFailures();
    loadCarsAndParts();
  } else {
    showNotif(data.error, true);
  }
}

document.getElementById('fitForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/assignments/fit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      car_id: document.getElementById('fit_car_id').value,
      serial_number: document.getElementById('fit_serial').value
    })
  });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    loadCarsAndParts();
  } else {
    showNotif(data.error, true);
  }
});

document.getElementById('failureForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/failures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serial_number: document.getElementById('fail_serial').value,
      severity: document.getElementById('fail_severity').value,
      failure_reason: document.getElementById('fail_reason').value
    })
  });
  const data = await res.json();
  if (res.ok) {
    showNotif(data.message);
    document.getElementById('failureForm').reset();
    loadFailures();
    loadCarsAndParts();
  } else {
    showNotif(data.error, true);
  }
});

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

checkUser();
loadCarsAndParts();
loadFailures();