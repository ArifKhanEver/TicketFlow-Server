const dns = require("node:dns");
dns.setServers(['8.8.8.8', '8.8.4.4', "1.1.1.1"]);

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// ----------------- Middleware -----------------
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://ticket-flow-online.vercel.app"
    ],
    credentials: true
}));
app.use(express.json());

// ----------------- Database Config -----------------
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let db;
let ticketCollection;
let vendorCollection;
let usersCollection;
let sessionCollection;
let bookingCollection;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("TicketFlow");
        ticketCollection = db.collection('tickets');
        vendorCollection = db.collection('vendors');
        usersCollection = db.collection('user');
        sessionCollection = db.collection('session');
        bookingCollection = db.collection('bookings');

        // await client.db("admin").command({ ping: 1 });
        console.log("🟢 Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("🔴 Failed to connect to MongoDB:", error);
    }
}

connectDB();

const verifyDbReady = (req, res, next) => {
    if (!usersCollection || !ticketCollection) {
        return res.status(503).json({ error: "Database is initializing, please try again in a moment." });
    }
    next();
};


const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
        return res.status(401).send({ message: "unauthorized token" })
    }

    const query = { token: token }
    const session = await sessionCollection.findOne(query)
    const userId = session.userId

    const userQuery = {
        _id: userId
    }

    const user = await usersCollection.findOne(userQuery)

    req.user = user
    next()
}

const verifyUser = async (req, res, next) => {
    if (req.user?.role !== "user") {
        return res.status(403).send({ message: "forbidden access" })
    }
    next();
}


const verifyVendor = async (req, res, next) => {
    if (req.user?.role !== "vendor") {
        return res.status(403).send({ message: "forbidden access" })
    }
    next();
}


const verifyAdmin = async (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" })
    }
    next();
}

// Root Route 
app.get('/', verifyDbReady, async (req, res) => {
    res.send("Tickets are hovering on the horizon. Go grab them")
})

//Getting Users
app.get('/api/users', verifyDbReady, async (req, res) => {
    try {
        const result = await usersCollection.find().toArray();
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//Modifying Users role
app.patch('/api/users', verifyDbReady, async (req, res) => {
    try {
        const { userId, modifiedRole, banned } = req.body;

        if (!userId) {
            return res.status(400).send({ success: false, error: "User identity token (userId) is required" });
        }

        const filter = { _id: new ObjectId(userId) };

        const updateDoc = {
            $set: {
                role: modifiedRole,
                banned: banned
            }
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            res.send({
                success: true,
                message: "User privileges and BetterAuth ban logs synchronized successfully."
            });
        } else {
            res.status(404).send({
                success: false,
                error: "No matching user profile found within the database registry."
            });
        }
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});


// Creating Ticket
app.post('/api/tickets', verifyDbReady, async (req, res) => {
    try {
        const ticket = { ...req.body, createdAt: new Date() }
        const result = await ticketCollection.insertOne(ticket)
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})

// GET: Global Multi-Role Ticket Matrix Pipeline (With Scalability & Fraud Exclusion Filter)
app.get('/api/tickets', verifyDbReady, async (req, res) => {
    try {
        const { vendorId, role, featured, limit } = req.query;
        let query = {};
        let sortOption = { departureDateTime: 1 };

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentStringTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        const bannedUsers = await usersCollection.find({ banned: true }, { projection: { _id: 1 } }).toArray();
        const bannedVendorIds = bannedUsers.map(user => user._id.toString());

        if (role === 'admin') {
            query.departureDateTime = { $gt: currentStringTime };
            // query.vendorId = { $nin: bannedVendorIds };
        }
        else if (vendorId) {
            query.vendorId = vendorId;
        }
        else {
            query.status = "approved";
            query.departureDateTime = { $gt: currentStringTime };
            query.vendorId = { $nin: bannedVendorIds };

            if (featured === 'true') {
                query.isAdvertised = true;
                sortOption = { departureDateTime: 1 };
            } else {
                sortOption = { _id: -1 };
            }
        }

        let cursor = ticketCollection.find(query).sort(sortOption);

        if (limit) {
            cursor = cursor.limit(parseInt(limit));
        }

        const result = await cursor.toArray();
        res.send({ success: true, data: result });

    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});


// Getting Ticket Details
app.get('/api/tickets/:id', verifyDbReady, async (req, res) => {
    try {
        const { id } = req.params
        const result = await ticketCollection.findOne(new ObjectId(id))
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


// Approving tickets by admin
app.patch('/api/bookings', verifyDbReady, async (req, res) => {
    try {
        const { ticketId, actionStatus } = req.body;

        if (!ticketId) {
            return res.status(400).send({ success: false, error: "Ticket Id id required" })
        }

        const filter = { _id: new ObjectId(ticketId) }
        const updatedDoc = {
            $set: {
                status: actionStatus
            }
        }
        const result = await ticketCollection.updateOne(filter, updatedDoc)

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            res.send({ success: true, message: "Status updated successfully" });
        } else {
            res.status(404).send({ success: false, error: "No booking record found to update" });
        }
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})



// Admin Route: Toggle advertisement with strict campaign slot management
app.patch('/api/tickets/advertise', verifyDbReady, async (req, res) => {
    try {
        const { ticketId, isAdvertised } = req.body;
        const currentServerTime = new Date().toISOString();

        if (isAdvertised === true) {
            const activeFeaturedCount = await ticketCollection.countDocuments({
                isAdvertised: true,
                departureDateTime: { $gt: currentServerTime }
            });

            if (activeFeaturedCount >= 6) {
                return res.status(400).send({
                    success: false,
                    error: "Campaign Overload: Maximum of 6 active tickets can be advertised simultaneously. Please revoke an active promotion before escalating a new fleet."
                });
            }
        }

        const filter = { _id: new ObjectId(ticketId) };
        const updateDoc = { $set: { isAdvertised } };
        
        await ticketCollection.updateOne(filter, updateDoc);
        res.send({ success: true, message: "Campaign registry parameters modified successfully." });

    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});


// Booking Ticket
app.post('/api/bookings', verifyDbReady, async (req, res) => {
    try {
        const booking = { ...req.body, createdAt: new Date() }
        const result = await bookingCollection.insertOne(booking)
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})

// My Booked Tickets
// GET: Fetch bookings for a specific user via Search Query (Temporary Setup)
app.get('/api/bookings/my-bookings', verifyDbReady, async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).send({ success: false, error: "User Id query parameter is required" });
        }

        const query = { userId: userId };
        const result = await bookingCollection.find(query).toArray();

        res.send({ success: true, data: result });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});


// allBookings for admin
// GET: Admin Access Only - Fetch platform-wide global booking logs
app.get('/api/bookings/admin/all-bookings', verifyDbReady, async (req, res) => {
    try {
        const { role } = req.query;
        if (role !== 'admin') {
            return res.status(403).send({
                success: false,
                error: "Access Denied: Only administrative privilege tokens are authorized to fetch the global booking matrix."
            });
        }

        const result = await bookingCollection.find({}).toArray();
        res.send({
            success: true,
            data: result
        });

    } catch (error) {
        res.status(500).send({
            success: false,
            error: error.message
        });
    }
});


// Requested Booking Tickets
// GET: Fetch bookings for a specific user via Search Query (Temporary Setup)
app.get('/api/bookings/requested-bookings', verifyDbReady, async (req, res) => {
    try {
        const { vendorId } = req.query;
        if (!vendorId) {
            return res.status(400).send({ success: false, error: "Vendor Id query parameter is required" });
        }

        const query = { vendorId: vendorId };
        const result = await bookingCollection.find(query).toArray();

        res.send({ success: true, data: result });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});


// Updating Bookings Requests status
app.patch('/api/bookings/requested-bookings', verifyDbReady, async (req, res) => {
    try {
        const { bookingId, actionStatus } = req.body;

        if (!bookingId) {
            return res.status(400).send({ success: false, error: "Booking Id is required" })
        }

        const filter = { _id: new ObjectId(bookingId) }
        const updatedDoc = {
            $set: {
                status: actionStatus
            }
        }
        const result = await bookingCollection.updateOne(filter, updatedDoc)
        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            res.send({ success: true, message: "Status updated successfully" });
        } else {
            res.status(404).send({ success: false, error: "No booking record found to update" });
        }
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// Decreasing total ticket count
app.patch('/api/bookings', verifyDbReady, async (req, res) => {
    try {
        const { ticketId, bookingQuantity } = req.body;

        if (!ticketId) {
            return res.status(400).send({ success: false, error: "Ticket Id id required" })
        }

        const filter = { _id: new ObjectId(ticketId) }
        const updatedDoc = {
            $inc: {
                quantity: -Number(bookingQuantity || 1)
            }
        }
        const result = await ticketCollection.updateOne(filter, updatedDoc)

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            res.send({ success: true, message: "Status updated successfully" });
        } else {
            res.status(404).send({ success: false, error: "No booking record found to update" });
        }
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// Booking status updating
app.patch('/api/bookings/status/:id', verifyDbReady, async (req, res) => {
    try {
        const { id } = req.params
        const { status } = req.body

        if (!["accepted", "rejected"].includes(status)) {
            return res.status(400).send({ success: false, error: "Invalid status dynamic type" })
        }

        const filter = { _id: new ObjectId(id) }
        const updatedDoc = {
            $set: {
                status: status
            }
        }
        const result = await bookingCollection.updateOne(filter, updatedDoc)
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// Booking delete
app.delete('/api/bookings/:id', verifyDbReady, async (req, res) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(400).send({ success: false, error: "Booking Id is required" })
        }

        const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) })
        if (result.deleteCount === 0) {
            return res.status(404).send({ success: false, error: "No booking found with this id" })
        }
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})



// ----------------- Server Listening (instant) -----------------
app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});

