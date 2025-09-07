const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.56yvv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let ordersCollection;
let usersCollection;
let addressCollection;
let blogsCollection;

async function run() {
  try {
    await client.connect();
    const Db = client.db('Ayira-Database');

    ordersCollection = Db.collection('orders');
    usersCollection = Db.collection('All-Users');
    addressCollection = Db.collection('address');
    blogsCollection = Db.collection('blogs');

    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB!");
  } catch (err) {
    console.error("❌ DB connection failed:", err);
  }
}
run().catch(console.dir);

// ---------------- ROUTES ----------------

// Root
app.get('/', (req, res) => {
  res.send('ayira server is running');
});

// Orders
app.post('/orders', async (req, res) => {
  try {
    const newOrder = req.body;
    const result = await ordersCollection.insertOne(newOrder);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const result = await ordersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Blogs
app.post('/blogs', async (req, res) =>{
  try{
    const newBlog = req.body;
    const result = await blogsCollection.insertOne(newBlog);
    res.send(result);
  }catch(err){
    res.status(500).send({ error: err.message});
  }

});
app.get('/blogs', async (req, res) => {
  try {
    const result = await blogsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});



// Users
app.post('/api/post-users', async (req, res) => {
  try {
    const user = req.body;
    const query = { email: user.email };

    const userAlreadyExist = await usersCollection.findOne(query);
    if (userAlreadyExist) {
      return res.send({ message: 'You are already registered. Please log in.', insertedId: null });
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/api/find-all-users', async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Address
app.post('/address', async (req, res) => {
  try {
    const address = req.body;
    const result = await addressCollection.insertOne(address);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/address', async (req, res) => {
  try {
    const addresses = await addressCollection.find().toArray();
    res.send(addresses);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ---------------- START SERVER ----------------
app.listen(port, () => {
  console.log('🚀 ayira server is running on port', port);
});
