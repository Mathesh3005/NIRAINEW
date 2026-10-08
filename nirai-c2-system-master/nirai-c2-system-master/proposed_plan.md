# NIRAI MVP Implementation Plan — Android App & Control Dashboard

## Executive Summary
This document outlines the Phase 1 (MVP Stage) development plan for **NIRAI**, derived from `NIRAI_Project_Architecture.md`. The MVP focuses on delivering a fully functional two-mode Android application (Civilian & Police), a web-based Command & Control Dashboard, and a core microservices backend with PostGIS geo-query capability and real-time WebSocket/FCM synchronization.

---

## 1. System Scope & MVP Deliverables

```
                         +-----------------------------------+
                         |      NIRAI Backend Services       |
                         | (Auth, Alert, Geo, Dispatch, WS)  |
                         +-----------------+-----------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
     +------------------------------+              +------------------------------+
     |      NIRAI Android App       |              |  Command & Control Dashboard |
     |  (Civilian & Police Modes)   |              |   (Web - React + TypeScript) |
     +------------------------------+              +------------------------------+
```

### Module 1: Android App (Kotlin + Jetpack Compose)
- **Civilian Mode**:
  - Panic SOS trigger with 5-second countdown & cancellation.
  - Automatic payload packaging: GPS coordinates (`FusedLocationProviderClient`), timestamp, media snippet attachment (`CameraX`).
  - Emergency contact SMS fallback (`SmsManager`) when internet is degraded.
  - Active case tracker (showing assigned police unit status & live ETA).
- **Police Mode**:
  - Authenticated duty status toggle (`on_duty` / `off_duty`).
  - Background location heartbeat streaming (10–15s interval).
  - Priority dispatch queue with "Acknowledge" & turn-by-turn navigation link handoff.
  - Proximity alert view for open SOS cases within assigned beat/jurisdiction.

### Module 2: Command & Control Dashboard (React + TypeScript + Tailwind)
- **Live Alert Map**: Mapbox GL JS / Leaflet interface plotting real-time SOS pins (color-coded by age/severity) and active police units.
- **Police Unit Tracker**: Ranked nearest-available officer list with road-distance/ETA calculations and manual assignment triggers.
- **Drone Fleet Control (MVP Simulated Layer)**:
  - Live status grid for Mother/Child drone units.
  - Human-in-the-loop "Confirm Dispatch" workflow with Digital Sky no-fly zone verification check.
  - Telemetry feed and simulated video stream view.
- **Case Log**: Chronological audit trail of SOS alerts, operator actions, assignments, and resolution states.

### Module 3: Core Backend (Node.js/NestJS or Kotlin/Spring Boot)
- **Database**: PostgreSQL 16 + PostGIS extension for spatial queries; Redis for live location indexing.
- **Services**:
  - `Auth`: Phone OTP + JWT + Police credential elevation workflow.
  - `Alert & Triage`: SOS ingestion, validation, and lifecycle state machine (`raised` -> `verifying` -> `unit_assigned` -> `drone_requested` -> `airborne` -> `on_scene` -> `resolved`).
  - `Geo-Query`: PostGIS radial spatial queries (`ST_DWithin`) for nearby units/civilians.
  - `Dispatch`: Officer assignment and WebSocket notification dispatch.
- **Real-Time Layer**: WebSockets (`ws`) for dashboard telemetry and FCM for mobile push notifications.

---

## 2. Technical Architecture & Data Flow

```
[Android SOS Trigger] ──> [API Gateway] ──> [Alert Service] ──> DB (PostgreSQL + PostGIS)
                                                   │
                                                   ├──> [Geo-Query Engine] (Redis Spatial Index)
                                                   │
                                                   ├──> [WebSocket Server] ──> [Dashboard Live Map]
                                                   │
                                                   └──> [FCM Push Service] ──> [Police Officer App]
```

---

## 3. Database Schema (MVP Subsets)

```sql
-- PostgreSQL + PostGIS Core Tables

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('civilian', 'police', 'admin');
CREATE TYPE case_status AS ENUM ('raised', 'verifying', 'unit_assigned', 'drone_requested', 'airborne', 'on_scene', 'resolved', 'false_alarm');
CREATE TYPE drone_type AS ENUM ('mother', 'child');
CREATE TYPE drone_status AS ENUM ('docked', 'charging', 'airborne', 'returning', 'maintenance');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'civilian',
    police_id_verified BOOLEAN DEFAULT FALSE,
    trusted_contacts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE officer_duty_status (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    on_duty BOOLEAN DEFAULT FALSE,
    current_location GEOMETRY(Point, 4326),
    last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_user_id UUID REFERENCES users(id),
    status case_status NOT NULL DEFAULT 'raised',
    trigger_location GEOMETRY(Point, 4326) NOT NULL,
    severity_score INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE case_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES cases(id),
    officer_user_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    eta_seconds INT
);

CREATE TABLE drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type drone_type NOT NULL,
    status drone_status NOT NULL DEFAULT 'docked',
    battery_pct INT DEFAULT 100,
    last_known_location GEOMETRY(Point, 4326),
    parent_mother_id UUID REFERENCES drones(id)
);
```

---

## 4. Implementation Phasing & Milestones

| Milestone | Horizon | Focus Areas & Action Items |
|---|---|---|
| **M1: Foundation & Backend Setup** | Week 1 | Environment configuration, PostgreSQL/PostGIS setup, Auth service implementation (OTP & JWT), Redis Geo setup, REST API skeletons. |
| **M2: Android Core & SOS Engine** | Week 2 | Jetpack Compose UI frames, SOS trigger & 5s countdown, `FusedLocationProviderClient` integration, backend REST payload submission, offline SMS handler. |
| **M3: Police Mode & Geo-Query Layer** | Week 3 | Server-side role elevation, background location heartbeat service in Android, PostGIS radial nearest-unit spatial queries (`ST_DWithin`). |
| **M4: Web Dashboard & Real-Time Sync** | Week 4 | Web app initialization (React/TS), Mapbox/Leaflet map rendering, WebSocket ingestion for live case pins & officer positions, manual unit assignment UI. |
| **M5: Drone Control Simulation & Audit Log** | Week 5 | Drone fleet status grid, "Confirm Dispatch" modal with simulated Digital Sky check, simulated telemetry stream, evidence audit trail logging. |
| **M6: E2E Integration & Verification** | Week 6 | End-to-end integration test (SOS trigger -> backend triage -> dashboard alert -> officer dispatch acknowledgment -> simulated drone launch -> resolution). |

---

## 5. Key Verification Strategy

- **Backend API Testing**: Unit & integration tests for Auth, Alert creation, PostGIS spatial queries, and WebSocket broadcasting.
- **Android App Functional Test**: Simulated SOS triggers, location updates via Android Emulator Location Mocking, offline SMS fallback verification.
- **Dashboard UI Validation**: Real-time rendering under simulated load (20+ mock officer location streams, multiple simultaneous SOS alerts).
- **Human-in-the-Loop Gate Test**: Verifying that no automated path can update drone state without explicit operator authorization payload (`POST /v1/cases/{id}/dispatch-drone`).
