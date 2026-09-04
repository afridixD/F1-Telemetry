
# Paddock Pass - F1 Pit-Crew Database Management System

## Setup Instructions

### 1. Database Setup
Ensure MySQL Server is active, then initialize the database schema and seed data:

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/seed.sql