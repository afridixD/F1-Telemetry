USE paddock_pass;

-- Roles
INSERT INTO roles (role_id, role_name) VALUES
(1, 'Admin'),
(2, 'Engineer'),
(3, 'Mechanic'),
(4, 'ShipmentOfficer');

-- Users: Passwords hashed with bcrypt (plain: password123)
INSERT INTO users (user_id, username, email, password_hash, role_id) VALUES
(1, 'adrian_newey', 'adrian@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 2),
(2, 'james_eng', 'james@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 2),
(3, 'calum_mech', 'calum@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 3),
(4, 'lee_mech', 'lee@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 3),
(5, 'sarah_logistics', 'sarah@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 4),
(6, 'marcus_logistics', 'marcus@f1paddock.internal', '$2a$10$wTqKjE06L1W.Kspw92mffu0oG86g28h5kR2l52oM0Kq3zK7sX2bWe', 4);

-- Suppliers
INSERT INTO suppliers (supplier_id, supplier_name, contact_email) VALUES
(1, 'Brembo Racing', 'supply@brembo.it'),
(2, 'Pirelli Motorsport', 'f1tyres@pirelli.com'),
(3, 'Garrett Motion Turbos', 'motorsport@garrettmotion.com'),
(4, 'BBS Motorsport Wheels', 'sales@bbs-racing.de'),
(5, 'McLaren Applied Systems', 'sensors@mclarenapplied.com'),
(6, 'Sabelt Safety Systems', 'racing@sabelt.com');

-- Part Categories
INSERT INTO part_categories (category_id, category_name, max_lifespan_km) VALUES
(1, 'Front Wing Assembly', 2500),
(2, 'Carbon Brake Disc', 1200),
(3, 'Turbocharger Unit', 4000),
(4, 'MGU-K Hybrid Unit', 5000),
(5, 'Rear Wing & DRS Actuator', 3000),
(6, 'Gearbox Cassette', 3500);

-- Parts
INSERT INTO parts (serial_number, category_id, supplier_id, current_status, total_mileage_km, wear_percentage, created_by) VALUES
('FW-2026-001', 1, 6, 'Fitted', 1850.50, 74.02, 1),
('FW-2026-002', 1, 6, 'In Stock', 450.00, 18.00, 1),
('BRK-2026-101', 2, 1, 'Fitted', 1100.00, 91.67, 1),
('BRK-2026-102', 2, 1, 'In Stock', 250.00, 20.83, 2),
('BRK-2026-103', 2, 1, 'Failed', 890.00, 74.17, 2),
('TC-2026-301', 3, 3, 'Fitted', 3450.25, 86.26, 1),
('TC-2026-302', 3, 3, 'In Stock', 600.00, 15.00, 2),
('MGU-2026-401', 4, 5, 'In Transit', 0.00, 0.00, 1),
('MGU-2026-402', 4, 5, 'In Stock', 1200.00, 24.00, 2),
('RW-2026-501', 5, 6, 'Fitted', 2600.00, 86.67, 1),
('GBX-2026-601', 6, 5, 'Retired', 3520.00, 100.00, 1);

-- Cars
INSERT INTO cars (car_id, chassis_code, driver_name) VALUES
(1, 'RB-22-01', 'Max Verstappen'),
(2, 'RB-22-02', 'Sergio Perez'),
(3, 'SF-26-01', 'Charles Leclerc'),
(4, 'SF-26-02', 'Lewis Hamilton');

-- Part Assignments
INSERT INTO part_assignments (assignment_id, car_id, serial_number, mechanic_id, fitted_at, removed_at) VALUES
(1, 1, 'FW-2026-001', 3, '2026-08-01 08:30:00', NULL),
(2, 1, 'BRK-2026-101', 3, '2026-08-01 09:15:00', NULL),
(3, 1, 'TC-2026-301', 4, '2026-08-02 11:00:00', NULL),
(4, 2, 'RW-2026-501', 4, '2026-08-03 14:20:00', NULL),
(5, 1, 'GBX-2026-601', 3, '2026-07-10 09:00:00', '2026-07-28 17:00:00');

-- Failures
INSERT INTO part_failures (failure_id, serial_number, reported_by, failure_date, failure_reason, severity, is_resolved) VALUES
(1, 'BRK-2026-103', 3, '2026-08-10 16:45:00', 'Delamination along outer friction face causing severe brake bias oscillation.', 'High', FALSE),
(2, 'GBX-2026-601', 4, '2026-07-28 16:30:00', 'Dog ring wear on 4th gear causing missed upshifts under full load.', 'Critical', TRUE);

-- Shipments
INSERT INTO shipments (shipment_id, tracking_code, origin_location, status, estimated_arrival_date, dispatched_by) VALUES
(1, 'DHL-F1-9921', 'Milton Keynes Factory, UK', 'In Transit', '2026-09-02', 5),
(2, 'DHL-F1-8840', 'Brembo Plant, Curno, Italy', 'Pending', '2026-09-05', 5),
(3, 'DHL-F1-7712', 'McLaren Applied, Woking, UK', 'Delivered', '2026-08-20', 6);

-- Shipment Items
INSERT INTO shipment_items (shipment_item_id, shipment_id, serial_number, quantity) VALUES
(1, 1, 'MGU-2026-401', 1),
(2, 2, 'BRK-2026-102', 1),
(3, 3, 'MGU-2026-402', 1);