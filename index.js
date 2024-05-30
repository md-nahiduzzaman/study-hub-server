const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// config
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://study-hub-514b5.web.app",
      "https://study-hub-514b5.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// verify jwt token middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w5tdn25.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const assignmentCollection = client
      .db("studyHub")
      .collection("assignments");
    const submittedCollection = client.db("studyHub").collection("submitted");
    const reviewsCollection = client.db("studyHub").collection("reviews");

    // jwt generator
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear jwt token on logout
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    // get all assignment data from db
    app.get("/assignments", async (req, res) => {
      const filter = req.query.filter;
      let query = {};
      if (filter) query = { difficultyLevel: filter };
      const result = await assignmentCollection.find(query).toArray();
      res.send(result);
    });

    // get all reviews data from db
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    // get single data using id
    app.get("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.findOne(query);
      res.send(result);
    });

    // save a assignment data in db
    app.post("/assignment", verifyToken, async (req, res) => {
      const assignmentData = req.body;
      const result = await assignmentCollection.insertOne(assignmentData);
      res.send(result);
    });

    // update assignment data in db
    app.put("/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const assignmentData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...assignmentData,
        },
      };
      const result = await assignmentCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // delete assignment data from db
    app.delete("/assignment/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.deleteOne(query);
      res.send(result);
    });

    // save submitted assignment data in db
    app.post("/submitted-assignment", async (req, res) => {
      const submittedData = req.body;
      const result = await submittedCollection.insertOne(submittedData);
      res.send(result);
    });

    // get submitted assignment by email from db
    app.get("/my-submission/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      console.log(tokenEmail);
      console.log(email);
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { email };
      const result = await submittedCollection.find(query).toArray();
      res.send(result);
    });

    // get submitted assignment by status from db
    app.get("/pending-submission/:status", verifyToken, async (req, res) => {
      const status = req.params.status;
      const query = { status: status };
      const result = await submittedCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });

    // update submitted assignment data in db
    app.put("/assignment-result/:id", async (req, res) => {
      const id = req.params.id;
      const submittedData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...submittedData,
        },
      };
      const result = await submittedCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("study hub server is Running");
});

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
});
