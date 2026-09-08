# Nexus — Enterprise Hostel Management System

<div align="center">
  <br/>
  <a href="https://hostel-management-cyan-three.vercel.app/">
    <img src="https://img.shields.io/badge/Hostel_Management-Live_Demo-0070f3?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/badge/Electron-34.2.0-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite WAL" />
  <img src="https://img.shields.io/badge/React_18-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
</div>

**Nexus** is an offline-first desktop application engineered for residential educational institutions, colleges, and university hostels. It replaces manual paper trails and disjointed spreadsheets with a local SQLite database, ACID transactions, and a responsive administrative interface.

---

## 🌟 Key Functional Modules

### 1. Student Management & Comprehensive Dossiers
* **Master Registry**: Complete student lifecycle tracking with enrollment numbers, courses, academic departments, blood groups, and verified contact records.
* **Student Dossiers**: Detailed resident profile views with linked parent/guardian contacts, room history, and printable verified ID cards with barcode identifiers.
* **Admissions & Status**: Seamless enrollment with immediate eligibility for bed allocation.

### 2. Hostel Infrastructure & Atomic Allocations
* **5-Tier Spatial Hierarchy**: Hostels → Blocks → Floors → Rooms → Bed Berths.
* **ACID Room Allocations**: Atomic bed assignments, inter-room transfers, and vacating workflows with zero double-booking risk.
* **Dynamic Occupancy Matrix**: Real-time visualization of room capacity, vacant berths, and building-level occupancy rates.

### 3. Campus Operations Desk
* **Nightly Roll-Call Attendance**: High-speed curfew verification desk recording resident status (Present, Absent, Late, On-Leave).
* **Digital Gate Passes**: Multi-stage leave approval pipeline tracking outgoing, transit, and returned residents.
* **Maintenance & Facilities Pipeline**: Issue reporting and resolution tracking for electrical, plumbing, carpentry, and masonry repairs.
* **Institutional Notice Board**: Campus-wide broadcasts with category tagging and priority pinning.

### 4. Financial Ledger & Automated Billing
* **Semester Billing Pipeline**: Automatic generation of monthly accommodation invoices across active residents.
* **Payment Reconciliation**: Live tracking of paid, partial, and outstanding dues with exportable accounting summaries.
* **Cafeteria Opt-Out Logistics**: Weekend meal cancellation management to optimize campus dining resources and reduce food wastage.

### 5. Enterprise Security & Administration
* **Role-Based Access Control (RBAC)**: Fine-grained permission guards (`super_admin`, `admin`, `warden`, `accountant`, `staff`).
* **Cryptographic Passwords**: Strong password hashing using Bcrypt (work factor 12) with mandatory password change flags on initial setup.
* **Immutable Audit Trail**: Append-only system audit log recording all critical operational events with timestamps and actor IDs.
* **First-Time Setup Wizard**: Guided initial configuration for institutional branding and primary administrator setup.

### 6. Data Recovery & Portability
* **Automated & Manual Snapshots**: Gzip-compressed SQLite database backups with SHA-256 integrity validation.
* **Atomic Restore with Safety Rollback**: Pre-restore backup snapshots ensure instant rollback if any integrity constraint is violated.
* **Cross-Station `.nexus` Portability**: Encrypted container format for migrating institutional state between offline machines with merge or full-overwrite options.

---

## 💻 Technology Stack

* **Desktop Host**: Electron 34 with secure context isolation, sandboxing, and explicit IPC whitelist bridges.
* **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons.
* **Database Engine**: Embedded SQLite operating in Write-Ahead Logging (`WAL`) mode with Foreign Key enforcement.
* **ORM & Querying**: Drizzle ORM with zero network requirements.
* **Testing**: Vitest with 119 comprehensive unit and integration test suites.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher recommended)
* npm

### Installation & Development Run

1. Clone the repository:
   ```bash
   git clone https://github.com/prince19112003/cs-course-projects.git
   cd cs-course-projects/Hostel-Management-System
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the desktop application in development mode:
   ```bash
   npm run dev
   ```

4. Run automated test suites:
   ```bash
   npm test
   ```

### Building the Portable Windows Executable

To package a standalone, zero-install portable executable for Windows:
```bash
npm run package:portable
```
The resulting executable will be generated inside the `dist-electron/` directory:
```
dist-electron/Nexus Enterprise Hostel Management 1.0.0.exe
```

---

## 🔑 Default Initial Credentials (Fresh Database)

* **Initial Administrator Setup**: On first launch, complete the Setup Wizard to create your Super Administrator credentials.
* **Baseline Development Accounts**:
  * **Admin**: `admin@nexus.edu` | Pass: `admin` (or prompt for initial password change)
  * **Resident Student ID**: `STU-0001` (Aarav Sharma)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](../LICENSE) file for details.
