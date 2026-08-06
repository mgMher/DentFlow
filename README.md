# DentFlow - Dental Management System

**DentFlow** is a modern dental clinic management platform built with NestJS and React. It provides comprehensive tools for managing patients, appointments, dental records, treatments, billing, and staff.

## Features

- **Patient Management** - Full patient profiles with medical history, allergies, insurance info
- **Interactive Dental Chart (Odontogram)** - Visual SVG-based tooth chart with per-tooth status tracking
- **Appointment Scheduling** - Calendar and list views with conflict detection and recurring appointments
- **Treatment Catalog** - Configurable treatment catalog with multi-currency pricing (AMD/USD/RUB)
- **Billing & Invoices** - Invoice generation, payment tracking, revenue reports
- **Staff Management** - Dentist, receptionist, assistant roles with schedule management
- **Reports & Analytics** - Revenue, appointment, patient, and performance statistics
- **Multi-language Support** - Armenian (default), Russian, English via i18next
- **Dark Mode** - Full dark theme support
- **Multi-clinic Tenancy** - Single database with clinicId isolation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 9, TypeScript 5, Mongoose 7 |
| Frontend | React 19, TypeScript, MUI v6, Redux + Redux-Saga |
| Database | MongoDB 7 |
| Auth | JWT (access + refresh tokens) |
| i18n | react-i18next (hy, ru, en) |
| Styling | Emotion (MUI), DM Sans font |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 7+ (or Docker)
- npm

### Option 1: Docker (Recommended)

```bash
cd dentflow
docker-compose up -d
```

This starts MongoDB, the backend API (port 8000), and the frontend (port 3000).

### Option 2: Manual Setup

**1. Start MongoDB**

```bash
# Using Docker
docker run -d -p 27017:27017 --name dentflow-mongo mongo:7

# Or use a local MongoDB installation
mongod --dbpath /path/to/data
```

**2. Backend**

```bash
cd dentflow/backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secrets

# Seed sample data
npm run seed

# Start development server
npm run start:dev
```

The API will be available at `http://localhost:8000/api`
Swagger docs at `http://localhost:8000/api/docs`

**3. Frontend**

```bash
cd dentflow/frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm start
```

The app will be available at `http://localhost:3000`

### Seed Data

Run the seed script to populate the database with sample Armenian clinic data:

```bash
cd backend
npm run seed
```

This creates:
- **Clinic**: Ararat Dental Clinic (Yerevan)
- **Admin**: admin@ararat-dental.am / admin123
- **Dentists**: ani.hayrapetyan@ararat-dental.am / dentist123 (and 2 more)
- **Receptionist**: reception@ararat-dental.am / reception123
- **8 Patients** with Armenian names
- **15 Standard treatments** with AMD pricing

## Project Structure

```
dentflow/
├── backend/
│   ├── src/
│   │   ├── main.ts                 # App bootstrap
│   │   ├── app.module.ts           # Root module
│   │   ├── seed.ts                 # Database seeder
│   │   ├── config/                 # Database, JWT config
│   │   ├── common/                 # Guards, decorators, filters, interceptors, pipes
│   │   │   ├── guards/             # AuthGuard, RolesGuard, ClinicGuard
│   │   │   ├── decorators/         # @Public(), @Roles(), @CurrentUser()
│   │   │   ├── filters/            # GlobalExceptionFilter
│   │   │   ├── interceptors/       # TransformInterceptor
│   │   │   └── pipes/              # ParseObjectIdPipe
│   │   └── modules/
│   │       ├── auth/               # Authentication (register, login, JWT)
│   │       ├── clinics/            # Clinic profile & settings
│   │       ├── users/              # Staff management
│   │       ├── patients/           # Patient CRUD + medical history
│   │       ├── appointments/       # Appointment scheduling
│   │       ├── treatments/         # Treatment catalog
│   │       ├── dental-records/     # Odontogram + treatment entries
│   │       ├── billing/            # Invoices + payments
│   │       ├── schedule/           # Rooms, blocked times, availability
│   │       ├── notifications/      # In-app notifications
│   │       ├── reports/            # Analytics & reports
│   │       └── settings/           # Notification templates
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── index.tsx               # Entry point
│   │   ├── App.tsx                 # Root component
│   │   ├── api/                    # Axios client with interceptors
│   │   ├── components/
│   │   │   ├── ui/                 # Base components (StatCard, PageHeader, etc.)
│   │   │   ├── layout/             # Sidebar, Header, MainLayout
│   │   │   ├── odontogram/         # Dental chart SVG component
│   │   │   └── calendar/           # Appointment calendar
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── locales/                # i18n translations (hy, ru, en)
│   │   ├── pages/                  # Page components
│   │   ├── router/                 # React Router configuration
│   │   ├── store/                  # Redux + Saga (per-feature slices)
│   │   ├── types/                  # TypeScript interfaces
│   │   └── utils/                  # Theme, formatters, constants
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── ANALYSIS.md                     # Architecture comparison with TherapyLake
├── README.md
└── .gitignore
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register clinic + admin |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh token |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user profile |

### Patients
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/patients | List patients (paginated) |
| POST | /api/patients | Create patient |
| GET | /api/patients/:id | Get patient |
| PATCH | /api/patients/:id | Update patient |
| DELETE | /api/patients/:id | Deactivate patient |

### Appointments
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/appointments | List appointments |
| POST | /api/appointments | Create appointment |
| GET | /api/appointments/today | Today's appointments |
| GET | /api/appointments/calendar | Calendar data |
| PATCH | /api/appointments/:id | Update appointment |
| PATCH | /api/appointments/:id/cancel | Cancel appointment |

### Dental Records
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dental-records/:patientId/chart | Get dental chart |
| PATCH | /api/dental-records/:patientId/tooth | Update tooth status |
| POST | /api/dental-records/:patientId/treatment-entry | Add treatment entry |
| GET | /api/dental-records/:patientId/treatment-history | Treatment history |

### Billing
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/billing/invoices | List invoices |
| POST | /api/billing/invoices | Create invoice |
| POST | /api/billing/invoices/:id/payments | Add payment |
| GET | /api/billing/revenue | Revenue stats |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/dashboard | Dashboard summary |
| GET | /api/reports/revenue | Revenue report |
| GET | /api/reports/appointments | Appointment stats |
| GET | /api/reports/dentist-performance | Dentist performance |

## Multi-tenancy

DentFlow uses a **single shared database** with `clinicId` field isolation:

- Every clinic-specific schema includes `clinicId: ObjectId` (indexed)
- JWT tokens contain `clinicId` claim
- All service methods scope queries by `clinicId`
- `ClinicGuard` ensures every authenticated request has clinic context

## Roles & Permissions

| Role | Description |
|------|-------------|
| `super_admin` | Platform-level admin |
| `clinic_admin` | Full clinic management |
| `dentist` | Patient care, records, appointments |
| `receptionist` | Scheduling, patient intake, billing |
| `assistant` | Limited access, supports dentists |

## License

UNLICENSED - Private project

---

# README (Armenian / README)

## DentFlow - Ատdelays delays delays

DentFlow-delays delays delays delays delays delays delays delays delays.

### Delays delays

```bash
cd dentflow
docker-compose up -d
```

### Delays delays delays

- admin@ararat-dental.am / admin123
- ani.hayrapetyan@ararat-dental.am / dentist123
- reception@ararat-dental.am / reception123
