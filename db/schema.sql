CREATE DATABASE IF NOT EXISTS paddock_pass;
USE paddock_pass;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS shipment_items;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS part_failures;
DROP TABLE IF EXISTS part_assignments;
DROP TABLE IF EXISTS cars;
DROP TABLE IF EXISTS parts;
DROP TABLE IF EXISTS part_categories;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(30) UNIQUE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100)
) ENGINE=InnoDB;

CREATE TABLE part_categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL,
    max_lifespan_km INT
) ENGINE=InnoDB;

CREATE TABLE parts (
    serial_number VARCHAR(30) PRIMARY KEY,
    category_id INT NOT NULL,
    supplier_id INT NOT NULL,
    current_status ENUM('In Stock', 'Fitted', 'Failed', 'Retired', 'In Transit') NOT NULL DEFAULT 'In Stock',
    total_mileage_km DECIMAL(10,2) DEFAULT 0.00,
    wear_percentage DECIMAL(5,2) DEFAULT 0.00,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_parts_category FOREIGN KEY (category_id) REFERENCES part_categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_parts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    CONSTRAINT fk_parts_creator FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_parts_status (current_status),
    INDEX idx_parts_category (category_id)
) ENGINE=InnoDB;

CREATE TABLE cars (
    car_id INT PRIMARY KEY AUTO_INCREMENT,
    chassis_code VARCHAR(30) UNIQUE NOT NULL,
    driver_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE part_assignments (
    assignment_id INT PRIMARY KEY AUTO_INCREMENT,
    car_id INT NOT NULL,
    serial_number VARCHAR(30) NOT NULL,
    mechanic_id INT NOT NULL,
    fitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    removed_at DATETIME NULL,
    CONSTRAINT fk_pa_car FOREIGN KEY (car_id) REFERENCES cars(car_id) ON DELETE CASCADE,
    CONSTRAINT fk_pa_part FOREIGN KEY (serial_number) REFERENCES parts(serial_number) ON DELETE CASCADE,
    CONSTRAINT fk_pa_mechanic FOREIGN KEY (mechanic_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_pa_car (car_id),
    INDEX idx_pa_serial (serial_number),
    INDEX idx_pa_active (removed_at)
) ENGINE=InnoDB;

CREATE TABLE part_failures (
    failure_id INT PRIMARY KEY AUTO_INCREMENT,
    serial_number VARCHAR(30) NOT NULL,
    reported_by INT NOT NULL,
    failure_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    failure_reason TEXT NOT NULL,
    severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
    is_resolved BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_pf_part FOREIGN KEY (serial_number) REFERENCES parts(serial_number) ON DELETE CASCADE,
    CONSTRAINT fk_pf_reporter FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_pf_resolved (is_resolved)
) ENGINE=InnoDB;

CREATE TABLE shipments (
    shipment_id INT PRIMARY KEY AUTO_INCREMENT,
    tracking_code VARCHAR(50) UNIQUE NOT NULL,
    origin_location VARCHAR(100) NOT NULL,
    status ENUM('Pending', 'In Transit', 'Delivered', 'Delayed') DEFAULT 'Pending',
    estimated_arrival_date DATE,
    dispatched_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_shipments_dispatcher FOREIGN KEY (dispatched_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_shipments_status (status)
) ENGINE=InnoDB;

CREATE TABLE shipment_items (
    shipment_item_id INT PRIMARY KEY AUTO_INCREMENT,
    shipment_id INT NOT NULL,
    serial_number VARCHAR(30) NOT NULL,
    quantity INT DEFAULT 1,
    CONSTRAINT fk_si_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    CONSTRAINT fk_si_part FOREIGN KEY (serial_number) REFERENCES parts(serial_number) ON DELETE CASCADE,
    INDEX idx_si_shipment (shipment_id),
    INDEX idx_si_serial (serial_number)
) ENGINE=InnoDB;