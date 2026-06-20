# TicketFlow Server (Backend API)

## 📌 Project Purpose
TicketFlow Server is the backbone of the TicketFlow Online Ticket Booking Platform. Built using Node.js, Express.js, and MongoDB, this RESTful API securely manages user authentication state, role-based access controls, dynamic ticket management, and transaction handling via the Stripe payment gateway. It bridges transport vendors, travelers, and platform administrators efficiently.

## 🔗 Deployment & Client Repository
- **Live Server URL:** [Insert Live Server Link Here, e.g., Vercel/Render]
- **Client-side Repository:** [Insert GitHub Client Repo Link Here]

## 🛠️ Tech Stack & Key NPM Packages Used
- **Runtime Environment:** Node.js
- **Framework:** Express.js (v5.x)
- **Database:** MongoDB Native Driver
- **Security & Tokens:** `jose-cjs` / JWT for API protection
- **CORS Handling:** `cors`
- **Environment Management:** `dotenv`

## 🚀 Core Features & Backend Architecture
- **Role-Based Access Control (RBAC):** Robust middlewares (`verifyToken`, `verifyUser`, `verifyVendor`, `verifyAdmin`) to secure private endpoints based on BetterAuth database sessions and custom token matching.
- **Ticket Management API:** Complete CRUD endpoints allowing Vendors to add tickets (with automated pending status), update ticket structures, and delete entries safely.
- **Admin Supervision:** APIs for approving/rejecting vendor tickets, managing roles (Admin/Vendor), advertising selection toggles (capped at 6), and flagging fraudulent vendors.
- **Booking & Stripe Workflow:** Endpoints to initialize bookings with a "pending" state, calculate pricing dynamically based on booking quantities, verify departure timers, and fulfill transactions using Stripe secure processing.
- **Production Optimization:** Configured with advanced DNS network patches and explicit CORS origin configurations to completely eliminate 404, 504, or cross-origin request errors on production.

## 🔑 Environment Variables Setup
To run this server locally, create a `.env` file in the root directory and add the following keys:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_custom_jwt_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key

```

🛰️ API Endpoints Overview (Probable)
🔓 Public Routes
```
GET / - Server status check

GET /api/tickets - Fetch admin-approved tickets (with search, filter, sorting, and pagination logic)
```

🔒 Protected User Routes
```
POST /api/bookings - Submit a new ticket booking request (Pending status)

GET /api/user/bookings - Fetch booked tickets with countdown status

POST /api/payments/create-payment-intent - Handle Stripe transaction verification
```

🔒 Protected Vendor Routes
```
POST /api/tickets - Add a new ticket for verification

GET /api/vendor/tickets - View and manage self-added tickets (Update/Delete)

PATCH /api/bookings/:id - Accept or Reject user booking requests
```

🔒 Protected Admin Routes
```
PATCH /api/admin/tickets/:id - Approve or Reject vendor tickets

PATCH /api/admin/users/:id - Modify user roles or mark a vendor as fraud

PATCH /api/admin/advertise/:id - Toggle home advertisement banner
```

Developed by: Shafiqul Islam Khan