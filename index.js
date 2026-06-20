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
        "https://your-frontend-domain.com" 
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
        db = client.db("ticketflow");
        
        ticketCollection = db.collection('tickets');
        vendorCollection = db.collection('vendors');
        usersCollection = db.collection('users');
        sessionCollection = db.collection('sessions'); 
        bookingCollection = db.collection('bookings');

        await client.db("admin").command({ ping: 1 });
        console.log("🟢 Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        console.error("🔴 Failed to connect to MongoDB:", error);
    }
}

connectDB();

const verifyDbReady = (req, res, next) => {
    if (!ticketCollection || !vendorCollection) {
        return res.status(503).json({ error: "Database is initializing, please try again in a moment." });
    }
    next();
};


const verifyToken = async(req, res, next)=>{
    const authHeader = req.headers?.authorization;
    if(!authHeader){
        return res.status(401).send({message: "unauthorized access"})
    }

    const token = authHeader.split(" ")[1]

    if(!token) {
        return res.status(401).send({message: "unauthorized token"})
    }

    const query = {token: token}
    const session = await sessionCollection.findOne(query)
    const userId = session.userId

    const userQuery = {
        _id: userId
    }

    const user = await usersCollection.findOne(userQuery)

    req.user = user
    next()
}

const verifyUser = async(req, res, next)=> {
    if(req.user?.role !== "user"){
        return res.status(403).send({message: "forbidden access"})
    }
    next();
}


const verifyVendor = async(req, res, next)=> {
    if(req.user?.role !== "vendor"){
        return res.status(403).send({message: "forbidden access"})
    }
    next();
}


const verifyAdmin = async(req, res, next)=> {
    if(req.user?.role !== "admin"){
        return res.status(403).send({message: "forbidden access"})
    }
    next();
}



// ----------------- Server Listening (instant) -----------------
app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
});

