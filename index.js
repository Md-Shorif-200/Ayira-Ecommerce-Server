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
let categoriesCollection;

async function run() {
  try {
    await client.connect();
    const Db = client.db("Ayira-Database");

    ordersCollection = Db.collection('orders');
    usersCollection = Db.collection('All-Users');
    addressCollection = Db.collection('address');
    blogsCollection = Db.collection('blogs');
    commentsCollection = Db.collection('comments');
    productAttributeCollection = Db.collection('Product-Attributes');
    productReviewCollection = Db.collection('Product-Reviews');
    productsCollection = Db.collection('all-products');
    categoriesCollection = Db.collection('categories');

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("DB connection failed:", err);
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

// ---------------- Blog Routes with Multer ----------------

// Multer setup for blogs
const blogStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/blogs");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const uploadBlog = multer({ storage: blogStorage });

// Create blog
app.post("/blogs", uploadBlog.single("image"), async (req, res) => {
  try {
    const { title, category, content, metaTitle, metaDescription } = req.body;
    const blogImage = req.file ? `/uploads/blogs/${req.file.filename}` : null;

    const blogData = {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      image: blogImage,
      createdAt: new Date(),
    };

    const result = await blogsCollection.insertOne(blogData);

    // Always return JSON
    res.json({ success: true, blog: blogData, result });
  } catch (err) {
    console.error("Error saving blog:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const result = await blogsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.put("/blogs/:id", uploadBlog.single("image"), async (req, res) => {
  try {
    const { title, category, content, metaTitle, metaDescription } = req.body;
    const blogImage = req.file ? `/uploads/blogs/${req.file.filename}` : req.body.existingImage;

    const updatedBlog = {
      title, category, content, metaTitle, metaDescription, image: blogImage
    };

    const result = await blogsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updatedBlog }
    );

    res.json({ success: true, updatedBlog, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.delete("/blogs/:id", async (req, res) => {
  const blogId = req.params.id;
  await blogsCollection.deleteOne({ _id: new ObjectId(blogId) });

  res.status(200).end(); 
});

// MODIFIED: To ensure every new user gets a default role and permissions array
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

    const userWithDefaults = {
      ...user,
      role: user.role || 'user',
      permissions: user.permissions || [],
    };

    const result = await usersCollection.insertOne(userWithDefaults);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Add new category
app.post("/categories", async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).send({ error: "Category value is required" });

    const result = await categoriesCollection.insertOne({ value });

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Get all categories
app.get("/categories", async (req, res) => {
  try {
    const categories = await categoriesCollection.find().toArray();
    res.send(categories);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});


// NEW: Get a single user's data by email (for auth context)
app.get('/api/user/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }
        res.send(user);
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
});

// NEW: Update a user's role and permissions
app.patch("/api/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions } = req.body;

    if (!role) {
      return res.status(400).send({ error: "Role is required." });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        role: role,
        permissions: permissions || [],
      },
    };

    const result = await usersCollection.updateOne(filter, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: "User not found." });
    }

    res.send({ success: true, message: "User role updated successfully.", result });

  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).send({ error: err.message });
  }
});

// NEW: Endpoint to DELETE a user by ID
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(filter);

        if (result.deletedCount === 0) {
            return res.status(404).send({ error: "User not found." });
        }
        
        res.send({ success: true, message: "User deleted successfully." });

    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).send({ error: err.message });
    }
});



// Delete category
app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const result = await categoriesCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// ---------------- Comments ----------------
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

// ---------------- Users ----------------
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

// ---------------- Address ----------------
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

// ---------------- Product Management ----------------

// Multer setup for products
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/products");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });


// ---------- Routes ----------



// Handle product with images and files
app.post(
  "/post-products",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "brandLogo", maxCount: 10 },

    { name: "mainPdfs", maxCount: 10 }, // <-- Added mainPdfs for PDF uploads
  ]),
  async (req, res) => {
    try {
      // text fields and stringified JSON from the form
      const {
        title,
        productCode,
        GSM_Code, // <-- New field
        productCategory,
        productSubCategory,
        productSize,
        colors,
        Gender,
        fit,
        Sustainability,
        price,
        disCountPrice,
        email,
        availabelVarients, // <-- New field (stringified JSON)
        metaTitle,         // <-- New field
        metaDescription,   // <-- New field
        description,       // rich description (stringified JSON)
        printingEmbroidery, // <-- New field (stringified JSON)
        textileCare,       // <-- New field (stringified JSON)
      } = req.body;


      // Parse stringified JSON fields into objects/arrays

      const productColors = colors ? JSON.parse(colors) : [];
      const parsedVariants = availabelVarients ? JSON.parse(availabelVarients) : [];
      const parsedDescription = description ? JSON.parse(description) : null;
      const parsedPrintingEmbroidery = printingEmbroidery ? JSON.parse(printingEmbroidery) : null;
      const parsedTextileCare = textileCare ? JSON.parse(textileCare) : null;



      // Handle uploaded files

      const mainImage = req.files["mainImage"]
        ? `/uploads/products/${req.files["mainImage"][0].filename}`
        : null;

      const galleryImages = req.files["galleryImages"]
        ? req.files["galleryImages"].map(file => `/uploads/products/${file.filename}`)
        : [];

      const brandLogo = req.files["brandLogo"]

        ? req.files["brandLogo"].map((file) => `/uploads/products/${file.filename}`)
        : [];

      const mainPdfs = req.files["mainPdfs"]
        ? req.files["mainPdfs"].map((file) => `/uploads/products/${file.filename}`)
        : [];


      // Construct the final data object to be saved in MongoDB
      const productData = {
        title,
        metaTitle,
        metaDescription,
        productCode,
        GSM_Code,
        productCategory,
        productSubCategory,
        productSize, // Note: This might be a general size range, variants handle specifics
        productColors, // General colors available
        availabelVarients: parsedVariants, // Specific color/size combinations
        Gender,
        fit,
        Sustainability,
        price: Number(price),
        disCountPrice: disCountPrice ? Number(disCountPrice) : null,
        description: parsedDescription,
        printingEmbroidery: parsedPrintingEmbroidery,
        textileCare: parsedTextileCare,
        email,
        mainImage,
        galleryImages,
        brandLogo,
        mainPdfs,

        createdAt: new Date(),
      };

      const result = await productsCollection.insertOne(productData);

      res.send({ success: true, message: "Product created successfully", insertedId: result.insertedId });
    } catch (err) {
      console.error("Error saving product:", err);
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

// ---------------- Product Attributes ----------------
app.post("/post-productAttribute", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !value) return res.status(400).send({ error: "Key and value are required" });

    const result = await productAttributeCollection.updateOne(
      {},
      { $push: { [`productAttributes.${key}`]: { id: new Date().getTime().toString(), value } } },
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

// ---------------- Product Reviews ----------------
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

// ---------------- START SERVER ----------------
app.listen(port, () => {
  console.log("🚀 ayira server is running on port", port);
});