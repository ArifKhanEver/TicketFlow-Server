# 🚌 TicketFlow Server (Backend API Engine)

TicketFlow Server is the high-performance, secure, and scalably architected backend powerhouse driving the **TicketFlow Online Ticket Booking Platform**. Engineered using Node.js, Express.js, and the native MongoDB driver, this enterprise-grade RESTful API orchestrates secure cross-domain state management, fine-grained Role-Based Access Control (RBAC), multi-tenant inventory pipelines, and automated financial transaction streams via the Stripe payment gateway.

---

## 🔗 Deployment & System Infrastructure

* **Live API Gateway:** https://ticket-flow-server.vercel.app
* **Production Client App:** https://ticket-flow-online.vercel.app
* **Client-Side Source Repository:** https://github.com/ArifKhanEver/TicketFlow-Online-Ticket-Booking-Platform

---

## 🛠️ Enterprise Tech Stack & Dependency Matrix

* **Runtime Core:** Node.js (Asynchronous, Event-Driven I/O Architecture)
* **API Framework:** Express.js (v5.x cutting-edge routing pipeline)
* **Database Engine:** MongoDB Native Driver (Optimized for low-overhead raw database cursors and aggregate tracking)
* **Authentication Security:** `jose-cjs` / JWT (JSON Web Tokens) for lightweight cryptographic handshake verification
* **Cross-Origin Protection:** `cors` (Configured with dynamic runtime origin lookup and reverse proxy trust states)
* **Environment Control:** `dotenv` (Enforcing absolute isolation between local development variables and cloud systems)

---

## 🚀 Core Features & Advanced Backend Architecture

### 1. Global Multi-Role Ticket Matrix Pipeline
The entire transport ecosystem is managed via a single, highly optimized endpoint (`GET /api/tickets`) that acts as a polymorphic data channel utilizing **Scoped Default Assignment**:
* **Admin Tier:** Bypasses pagination limits and fraud filters to return all upcoming inventory for holistic oversight.
* **Vendor Tier:** Isolate and stream tenant-specific inventory mapped directly to the active vendor session identifier.
* **Public Tier:** Implements a strict consumer gate returning only *approved* tickets with real-time departure validation ($departureDateTime > now$). It processes case-insensitive regex route lookups and comma-separated array tracking (`$in`) for multi-vehicle filter matrices, bounded by a standard 8-item page limit.

### 2. Live Fraud Exclusion & Automated Safeguards
* Enforces an instantaneous **Fraud Filter Layer** across public endpoints. It resolves cross-collection queries to capture banned vendors run-time, automatically dropping their listings from consumer search grids without interrupting the master sequence.

### 3. Rigid Cryptographic Session Gates
* Built-in server middleware layers (`verifyToken`, `verifyUser`, `verifyVendor`, `verifyAdmin`) read stateful signatures seamlessly. They sync client payloads directly with BetterAuth server-side cookies, eliminating malicious request forgery.

### 4. Bulletproof Price Evaluation & Payment Streams
* Rejects unsafe client-side price injections. The transaction endpoint fetches inventory rates from the ground-truth database to calculate financial bounds before generating safe Stripe payment intents.

### 5. Production Network Layer Optimization
* Features a production-ready CORS layout leveraging proxy-trust handshakes (`app.set('trust proxy', 1)`), providing smooth state mutations via complex HTTP verbs (like `PATCH` and `OPTIONS`) on high-security networks.

---

## 🔑 Environment Variables Setup

To spin up this backend infrastructure locally, clone the repository, establish a `.env` file within your root workspace, and seed it with the required config:

```env
# System Configurations
PORT=5000

# Security Clefs & Database Links
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_high_entropy_cryptographic_jwt_secret_key

# Payment Gateways
STRIPE_SECRET_KEY=your_private_stripe_live_or_test_key

# Cross-Origin Target Links
CLIENT_URL=http://localhost:3000