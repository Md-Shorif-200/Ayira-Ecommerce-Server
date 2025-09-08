const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(express.json());
app.use(cors());

// Serve uploaded images statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.56yvv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let ordersCollection;
let usersCollection;
let addressCollection;
let blogsCollection;
let commentsCollection;
let productAttributeCollection;
let productReviewCollection;
let productsCollection;

async function run() {
  try {
    await client.connect();
    const Db = client.db("Ayira-Database");

    ordersCollection = Db.collection('orders');
    usersCollection = Db.collection('All-Users');
    addressCollection = Db.collection('address');
    blogsCollection = Db.collection('blogs');
    commentsCollection = Db.collection('comments');
    productAttributeCollection = Db.collection('Product-Collections');
    productReviewCollection = Db.collection('Product-Reviews');
    productsCollection = Db.collection('all-products');

    await client.db("admin").command({ ping: 1 });
    console.log(" Connected to MongoDB!");
  } catch (err) {
    console.error(" DB connection failed:", err);
  }
}
run().catch(console.dir);

// ---------------- ROUTES ----------------

// Root
app.get("/", (req, res) => {
  res.send("ayira server is running");
});

// Orders
app.post("/orders", async (req, res) => {
  try {
    const newOrder = req.body;
    const result = await ordersCollection.insertOne(newOrder);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/orders", async (req, res) => {
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
// delete blog
  app.delete("/blogs/:id", async (req, res) => {
    const id = req.params.id;
    const result = await blogsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  // update blog
  app.put("/blogs/:id", async (req, res) => {
    const id = req.params.id;
    const updatedBlog = req.body;
    const result = await blogsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedBlog }
    );
    res.send(result);
  });


// blog page comment

app.post('/comments', async (req, res) => {
  try {
    const comment = req.body;
    const result = await commentsCollection.insertOne(comment);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get('/comments', async (req, res) => {
  try {
    const result = await commentsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});


// Users
app.post("/api/post-users", async (req, res) => {
  try {
    const user = req.body;
    const query = { email: user.email };

    const userAlreadyExist = await usersCollection.findOne(query);
    if (userAlreadyExist) {
      return res.send({
        message: "You are already registered. Please log in.",
        insertedId: null,
      });
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/find-all-users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Address
app.post("/address", async (req, res) => {
  try {
    const address = req.body;
    const result = await addressCollection.insertOne(address);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/address", async (req, res) => {
  try {
    const addresses = await addressCollection.find().toArray();
    res.send(addresses);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ------------------------- product management related api-------------

app.post("/post-productAttribute", async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key || !value) {
      return res.status(400).send({ error: "Key and value are required" });
    }

    // Dynamic field push
    const result = await productAttributeCollection.updateOne(
      {},
      {
        $push: {
          [`productAttributes.${key}`]: {
            id: new Date().getTime().toString(), // auto unique id
            value: value,
          },
        },
      },
      { upsert: true }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/find-productAttributes", async (req, res) => {
  try {
    const result = await productAttributeCollection.find().toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ------------------ Product Reviews ------------------
app.post("/post-productReview", async (req, res) => {
  try {
    const data = req.body;
    const result = await productReviewCollection.insertOne(data);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/find-productReview", async (req, res) => {
  try {
    const result = await productReviewCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});


// ------------------ All products  ------------------

// ---------- Multer Setup ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/products"); // save in uploads/products
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({ storage });

// ---------- Routes ----------



// Handle product with images
app.post(
  "/post-products",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "brandLogo", maxCount: 10 }, // <-- added brandLogo
  ]),
  async (req, res) => {
    try {
      // text fields
      const {
        title,
        productCode,
        productCategory,
        productSubCategory,
        productSize,
        color,
        Gender,
        fit,
        Sustainability,
        price,
        disCountPrice,
        description,
        email,
      } = req.body;

      // Images
      const mainImage = req.files["mainImage"]
        ? `/uploads/products/${req.files["mainImage"][0].filename}`
        : null;

      const galleryImages = req.files["galleryImages"]
        ? req.files["galleryImages"].map(
            (file) => `/uploads/products/${file.filename}`
          )
        : [];

      const brandLogo = req.files["brandLogo"]
        ? req.files["brandLogo"].map(
            (file) => `/uploads/products/${file.filename}`
          )
        : [];

      // final data
      const productData = {
        title,
        productCode,
        productCategory,
        productSubCategory,
        productSize,
        color,
        Gender,
        fit,
        Sustainability,
        price: Number(price),
        disCountPrice: disCountPrice ? Number(disCountPrice) : null,
        description,
        email,
        mainImage,
        galleryImages,
        brandLogo, // <-- add brandLogo here
        createdAt: new Date(),
      };

      const result = await productsCollection.insertOne(productData);

      res.send({ success: true, product: productData, result });
    } catch (err) {
      console.error(" Error saving product:", err);
      res.status(500).send({ success: false, error: err.message });
    }
  }
);




app.get("/find-products", async (req, res) => {
  try {
    const result = await productsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});




// ---------------- START SERVER ----------------
app.listen(port, () => {
  console.log("🚀 ayira server is running on port", port);
});
