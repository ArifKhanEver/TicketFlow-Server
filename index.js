const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.NEXT_CLIENT_URL}/api/auth/jwks`),
);


const verifyToken = async (req, res, next) => {
    const authHeader = req.headers?.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
        return res.status(401).send({ message: "unauthorized token" })
    }

    try{
        const {payload} = await jwtVerify(token, JWKS)
        req.user = payload
        next()
    }catch(error){
        console.log(error)
        return res.status(401).json({message: "unauthorized"})
    }

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


const run = async () => {
  try {
    // await client.connect();
    db = client.db("TicketFlow");
        ticketCollection = db.collection('tickets');
        vendorCollection = db.collection('vendors');
        usersCollection = db.collection('user');
        sessionCollection = db.collection('session');
        bookingCollection = db.collection('bookings');
        paymentCollection = db.collection('payments')


// app.get('/', async (req, res) => {
//     res.send("Tickets are hovering on the horizon. Go grab them.........")
    
// })

//Getting Users
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const result = await usersCollection.find().toArray();
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//Modifying Users role
app.patch('/api/users', verifyToken, verifyAdmin, async (req, res) => {
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
app.post('/api/tickets', verifyToken, verifyVendor, async (req, res) => {
    try {
        const ticket = { ...req.body, createdAt: new Date() }
        const result = await ticketCollection.insertOne(ticket)
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// Deleting Tickets
app.delete('/api/tickets/:id', verifyToken, verifyVendor, async (req, res) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(400).send({ success: false, error: "Ticket Id is required" })
        }

        const result = await ticketCollection.deleteOne({ _id: new ObjectId(id) })
        if (result.deleteCount === 0) {
            return res.status(404).send({ success: false, error: "No booking found with this id" })
        }
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// GET: Global Multi-Role Ticket Matrix Pipeline (With Scalability & Fraud Exclusion Filter)
// GET: Global Multi-Role Ticket Matrix Pipeline (With Scalability & Fraud Exclusion Filter)
app.get('/api/tickets', async (req, res) => {
    console.log("server query", req.query);
    try {
        const { vendorId, role, featured, page, limit, from, to, sort, transportType } = req.query;
        let query = {};
        let sortOption = { _id: -1 }; 

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentStringTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        const bannedUsers = await usersCollection.find({ banned: true }, { projection: { _id: 1 } }).toArray();
        const bannedVendorIds = bannedUsers.map(user => user._id.toString());

        const parsedPage = Number(page) || 1;
        let parsedLimit = limit ? Number(limit) : null; 

        if (role === 'admin') {
            query.departureDateTime = { $gt: currentStringTime };
            sortOption = { departureDateTime: 1 };
        } 
        else if (vendorId) {
            query.vendorId = vendorId;
        } 
        else {
            if (!parsedLimit) parsedLimit = 8;

            query.status = "approved";
            query.departureDateTime = { $gt: currentStringTime };
            query.vendorId = { $nin: bannedVendorIds };

            if (from) query.from = { $regex: from, $options: 'i' };
            if (to) query.to = { $regex: to, $options: 'i' };

            if (transportType) {
                const typesArray = transportType.split(',');
                query.transportType = { $in: typesArray };
            }

            if (sort === 'Price: Low to High') {
                sortOption = { price: 1 };
            } else if (sort === 'Price: High to Low') {
                sortOption = { price: -1 };
            } else if (sort === 'Earliest Departure') {
                sortOption = { departureDateTime: 1 };
            }

            if (featured === 'true') {
                query.isAdvertised = true;
                if (!sort || sort === 'Recommended') {
                    sortOption = { departureDateTime: 1 };
                }
            }
        }

        const totalCount = await ticketCollection.countDocuments(query);
        const totalPages = parsedLimit ? Math.ceil(totalCount / parsedLimit) : 1;

        let dbQuery = ticketCollection.find(query).sort(sortOption);

        if (parsedLimit) {
            const skip = (parsedPage - 1) * parsedLimit;
            dbQuery = dbQuery.skip(skip).limit(parsedLimit);
        }

        const tickets = await dbQuery.toArray();

        res.send({
            success: true,
            tickets,
            totalPages,
            totalCount,
            currentPage: parsedPage
        });

    } catch (error) {
        console.error("🚨 Tickets API Failure:", error.message);
        res.status(500).send({ success: false, error: error.message });
    }
});

// Getting Ticket Details
app.get('/api/tickets/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params
        const result = await ticketCollection.findOne(new ObjectId(id))
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


// Updating tickets by vendor
app.patch('/api/tickets', verifyToken, verifyVendor, async (req, res) => {
    try {
        const { ticketId, ...updateFields } = req.body;

        if (!ticketId) {
            return res.status(400).send({ 
                success: false, 
                error: "Authentication Failure: Ticket ID is strictly required for synchronization." 
            });
        }

        const filter = { _id: new ObjectId(ticketId) };
        
        const updatedDoc = {
            $set: updateFields
        };

        const result = await ticketCollection.updateOne(filter, updatedDoc);

        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            res.send({ 
                success: true, 
                message: "Ticket metrics updated successfully and queued for re-verification." 
            });
        } else {
            res.status(404).send({ 
                success: false, 
                error: "No corresponding ticket catalog record found to patch." 
            });
        }
    } catch (error) {
        console.error("🚨 Express Ticket Patch Exception Log:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});


// Approving tickets by admin
app.patch('/api/bookings', verifyToken, verifyAdmin, async (req, res) => {
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
app.patch('/api/tickets/advertise', verifyToken, verifyAdmin, async (req, res) => {
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
app.post('/api/bookings', verifyToken, async (req, res) => {
    try {
        const booking = { ...req.body, createdAt: new Date() }
        const result = await bookingCollection.insertOne(booking)
        res.send(result)
    } catch (error) {
        res.status(500).send({ error: error.message })
    }
})


// My Booked Tickets
app.get('/api/bookings/my-bookings', verifyToken, async (req, res) => {
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
app.get('/api/bookings/admin/all-bookings', verifyToken, verifyAdmin, async (req, res) => {
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
app.get('/api/bookings/requested-bookings', verifyToken, verifyVendor, async (req, res) => {
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
app.patch('/api/bookings/requested-bookings', verifyToken, async (req, res) => {
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
app.patch('/api/bookings', verifyToken, async (req, res) => {
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
app.patch('/api/bookings/status/:id', verifyToken, async (req, res) => {
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
app.delete('/api/bookings/:id', async (req, res) => {
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



// Saving transaction details after successful checkout
app.post('/api/payments/save', verifyToken, async (req, res) => {
    try {
        const { bookingId, transactionId, ticketId, ticketTitle, amount, customerEmail, status, userId, bookingQuantity} = req.body;

        if (!bookingId || !transactionId) {
            return res.status(400).send({ 
                success: false, 
                error: "Required parameters (bookingId, transactionId) are missing." 
            });
        }

        const existingPayment = await paymentCollection.findOne({ transactionId: transactionId });
        
        if (existingPayment) {
            return res.send({ 
                success: true, 
                message: "Transaction already verified and stored. Skipping duplicate insertion." 
            });
        }

        const bookingFilter = { _id: new ObjectId(bookingId) };
        const bookingUpdate = {
            $set: {
                status: status || "paid"
            }
        };
        await bookingCollection.updateOne(bookingFilter, bookingUpdate);

        const paymentDoc = {
            bookingId: bookingId,
            ticketId: ticketId || "",
            userId,
            bookingQuantity: Number(bookingQuantity),
            ticketTitle: ticketTitle || "Fleet Travel Token",
            transactionId: transactionId,
            amount: Number(amount) || 0,
            customerEmail: customerEmail || "",
            paidAt: new Date(),
            status: status || "paid"
        };

        const result = await paymentCollection.insertOne(paymentDoc);

        if (ticketId) {
            await ticketCollection.updateOne(
                { _id: new ObjectId(ticketId) },
                { $inc: { quantity: -Number(bookingQuantity || 1) } }
            );
        }

        if (result.insertedId) {
            res.send({ success: true, message: "Payment lifecycle recorded and booking status patched." });
        } else {
            res.status(500).send({ success: false, error: "Failed to isolate payment record." });
        }
    } catch (error) {
        console.error("🚨 Express Payment Database Splitting Exception:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});


//getting payment details
app.get('/api/payments/user', verifyToken, async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).send({ 
                success: false, 
                error: "UserId query parameter is required to track ledger entries." 
            });
        }

        const payments = await paymentCollection
            .find({ userId })
            .sort({ paidAt: -1 })
            .toArray();

        res.send({ success: true, payments });
    } catch (error) {
        console.error("🚨 Express Fetch User Payments Exception:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});


//Counting revenue (overview)
app.get('/api/revenue/overview', async (req, res) => {
    try {
        const { role, userId } = req.query;

        if (!role || !userId) {
            return res.status(400).send({ success: false, error: "Authentication parameters (role, userId) missing." });
        }

        const isAdmin = role === 'admin';

        const ticketMatch = isAdmin ? {} : { vendorId: userId };
        const totalTicketsDoc = await ticketCollection.aggregate([
            { $match: ticketMatch },
            { $group: { _id: null, total: { $sum: "$quantity" } } }
        ]).toArray();
        const totalTicketsAdded = totalTicketsDoc[0]?.total || 0;

        let paymentPipeline = [];

        if (!isAdmin) {
            paymentPipeline.push(
                { $match: { ticketId: { $exists: true, $ne: "" } } },
                { $addFields: { ticketObjId: { $toObjectId: "$ticketId" } } },
                {
                    $lookup: {
                        from: "tickets",
                        localField: "ticketObjId",
                        foreignField: "_id",
                        as: "ticketInfo"
                    }
                },
                { $unwind: "$ticketInfo" },
                { $match: { "ticketInfo.vendorId": userId } }
            );
        }

        const statsPipeline = [
            ...paymentPipeline,
            { 
                $group: { 
                    _id: null, 
                    totalRevenue: { $sum: "$amount" }, 
                    totalSold: { $sum: "$bookingQuantity" } 
                } 
            }
        ];
        
        const revenueDoc = await paymentCollection.aggregate(statsPipeline).toArray();
        const totalRevenueBDT = revenueDoc[0]?.totalRevenue || 0;
        const totalTicketsSold = revenueDoc[0]?.totalSold || 0;

        const chartPipeline = [
            ...paymentPipeline,
            {
                $group: {
                    _id: { $month: "$paidAt" },
                    revenue: { $sum: "$amount" },
                    sold: { $sum: "$bookingQuantity" }
                }
            },
            { $sort: { "_id": 1 } }
        ];
        const monthlyData = await paymentCollection.aggregate(chartPipeline).toArray();

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyAnalytics = monthNames.map((name, index) => {
            const match = monthlyData.find(item => item._id === index + 1);
            return {
                name,
                added: Math.floor(totalTicketsAdded / 12), 
                sold: match ? match.sold : 0,
                revenue: match ? match.revenue : 0
            };
        });

        res.send({
            success: true,
            metrics: {
                totalTicketsAdded,
                totalTicketsSold,
                totalRevenueBDT,
                monthlyAnalytics
            }
        });

    } catch (error) {
        console.error("🚨 DB Aggregation Pipeline Crash:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});


    
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome to TicketFlow!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
