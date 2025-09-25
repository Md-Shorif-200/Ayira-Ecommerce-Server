const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer"); // <--- ADD THIS LINE
const Pdfmake = require("pdfmake");
const fs = require("fs");

app.use(express.json());
// app.use(cors({ origin: "http://localhost:3000" }));

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5000",
      "https://ayira-ecommerce-main.vercel.app",
      "https://y-lac-seven.vercel.app",
      "https://aaryansourcing.com"
    ],
  })
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new Pdfmake(fonts);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.56yvv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let sizeChartsCollection;
let bannersCollection;
let ordersCollection;
let usersCollection;
let addressCollection;
let blogsCollection;
let commentsCollection;
let productAttributeCollection;
let productReviewCollection;
let productsCollection;
let categoriesCollection;
let wishListsCollection;

async function run() {
  try {
    await client.connect();
    const Db = client.db("Ayira-Database");

    sizeChartsCollection = Db.collection("sizeCharts");
    bannersCollection = Db.collection("banners");
    ordersCollection = Db.collection("orders");
    usersCollection = Db.collection("All-Users");
    addressCollection = Db.collection("address");
    blogsCollection = Db.collection("blogs");
    commentsCollection = Db.collection("comments");
    productAttributeCollection = Db.collection("Product-Attributes");
    productReviewCollection = Db.collection("Product-Reviews");
    productsCollection = Db.collection("all-products");
    categoriesCollection = Db.collection("categories");
    wishListsCollection = Db.collection("wishlists");

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
    const { search } = req.query;
    let query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    const result = await ordersCollection
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).send({ error: "Failed to fetch orders." });
  }
});

// --- Multer configuration for Banners ---
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/banners");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const bannerUpload = multer({ storage: bannerStorage });

// --- Multer configuration for size chart uploads ---
const sizeChartStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/size_charts");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const uploadSizeChart = multer({ storage: sizeChartStorage });

// ---------------- Blog Routes with Multer ----------------

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

// --- NEW: Middleware to handle two separate image fields for blogs ---
const blogUploadFields = uploadBlog.fields([
  { name: "image", maxCount: 1 },
  { name: "extraImage", maxCount: 1 },
]);

// Create blog (UPDATED)
app.post("/blogs", blogUploadFields, async (req, res) => {
  try {
    // 1. Destructure all new text fields from the request body
    const {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      shortDescription,
      note,
      tags,
    } = req.body;

    // 2. Handle files from req.files (plural) for both fields
    const blogImage =
      req.files && req.files["image"]
        ? `/uploads/blogs/${req.files["image"][0].filename}`
        : null;
    const extraBlogImage =
      req.files && req.files["extraImage"]
        ? `/uploads/blogs/${req.files["extraImage"][0].filename}`
        : null;

    // 3. Include all new fields in the data to be saved
    const blogData = {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      shortDescription,
      note,
      tags,
      image: blogImage,
      extraImage: extraBlogImage,
      createdAt: new Date(),
    };

    const result = await blogsCollection.insertOne(blogData);

    const newBlog = await blogsCollection.findOne({ _id: result.insertedId });
    res
      .status(201)
      .send({ message: "Blog created successfully", blog: newBlog });
  } catch (err) {
    console.error("Error creating blog:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

// ===============new get api for blog get=========

app.get("/blogs", async (req, res) => {
  try {
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

   
    const { search, category } = req.query;
    let query = {};
    if (category && category !== "all") {
      query.category = category;
    }
    if (search) {
      
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }
  const [blogs, totalBlogs] = await Promise.all([
      
      blogsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      
      blogsCollection.countDocuments(query),
    ]);

   
    const totalPages = Math.ceil(totalBlogs / limit);

  
    res.send({
      blogs,
      totalBlogs,
      totalPages,
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).send({ error: "Failed to fetch blogs." });
  }
});
// =========new code end========
app.get("/blogs/search-titles", async (req, res) => {
  try {
    const { q } = req.query; 

    if (!q || q.trim() === "") {
      return res.send([]);
    }
    
    const query = { title: { $regex: q, $options: "i" } };
    const projection = { _id: 1, title: 1 };

    const blogs = await blogsCollection
      .find(query)
      .project(projection)
      .limit(10)
      .toArray();

    res.send(blogs);
  } catch (err) {
    console.error("Error searching blog titles:", err);
    res.status(500).send({ error: "Failed to search blogs." });
  }
});

// NEW: Get a single blog by ID
app.get("/blogs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the ID format
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid blog ID format." });
    }

    const query = { _id: new ObjectId(id) };
    const blog = await blogsCollection.findOne(query);

    // If no blog is found, return a 404 error
    if (!blog) {
      return res.status(404).send({ error: "Blog not found." });
    }

    res.send(blog);
  } catch (err) {
    console.error("Error fetching single blog:", err);
    res.status(500).send({ error: err.message });
  }
});

// Update blog (UPDATED)
app.put("/blogs/:id", blogUploadFields, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid blog ID." });
    }

    // 1. Destructure all new text fields and existing image paths
    const {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      shortDescription,
      note,
      tags,
      existingImage,
      existingExtraImage,
    } = req.body;

    // 2. Logic to determine final image paths (new upload vs existing)
    const blogImage =
      req.files && req.files["image"]
        ? `/uploads/blogs/${req.files["image"][0].filename}`
        : existingImage || null;

    const extraBlogImage =
      req.files && req.files["extraImage"]
        ? `/uploads/blogs/${req.files["extraImage"][0].filename}`
        : existingExtraImage || null;

    // 3. Include all new fields in the updated data object
    const updatedBlogData = {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      shortDescription,
      note,
      tags,
      image: blogImage,
      extraImage: extraBlogImage,
      updatedAt: new Date(),
    };

    const result = await blogsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedBlogData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, error: "Blog not found." });
    }

    const updatedBlog = await blogsCollection.findOne({
      _id: new ObjectId(id),
    });
    res.send({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog,
    });
  } catch (err) {
    console.error("Error updating blog:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.delete("/blogs/:id", async (req, res) => {
  try {
    const blogId = req.params.id;
    await blogsCollection.deleteOne({ _id: new ObjectId(blogId) });
    res.status(204).end();
  } catch (err) {
    console.error("Error deleting blog:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



app.post("/categories", async (req, res) => {
  try {
    const { value } = req.body;
    if (!value)
      return res.status(400).send({ error: "Category value is required" });
    const result = await categoriesCollection.insertOne({ value });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const categories = await categoriesCollection.find().toArray();
    res.send(categories);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// ... (rest of your routes remain unchanged)

app.post("/api/post-users", async (req, res) => {
  try {
    const user = req.body;
    const query = { email: user.email };

    // console.log(user);

    const userAlreadyExist = await usersCollection.findOne(query);
    if (userAlreadyExist) {
      return res.send({
        message: "You are already registered. Please log in.",
        insertedId: null,
      });
    }

    const userWithDefaults = {
      ...user,
      role: user.role || "user",
      permissions: user.permissions || [],
    };

    const result = await usersCollection.insertOne(userWithDefaults);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const result = await categoriesCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});



app.get("/api/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    console.log(email);

    const query = { email: email };
    console.log(query);
    const user = await usersCollection.findOne(query);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

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
    res.send({
      success: true,
      message: "User role updated successfully.",
      result,
    });
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).send({ error: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
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

app.get("/api/find-all-users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
}); 

// GET /api/staff - Simple endpoint to get ALL staff members (for small lists)
app.get("/api/staff", async (req, res) => {
  try {
    const queryFilter = { role: 'staff' };
    const staff = await usersCollection.find(queryFilter).toArray();
    res.send(staff);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).send({ error: err.message });
  }
});

// GET /api/promotable-users - Lightweight endpoint for the AddStaff dropdown
app.get("/api/promotable-users", async (req, res) => {
  try {
    const query = { role: "user" };
    // Projection only sends the fields we absolutely need, making it very fast
    const options = {
      projection: { _id: 1, name: 1, email: 1 },
      sort: { name: 1 } // Sort alphabetically for a better user experience
    };
    const users = await usersCollection.find(query, options).toArray();
    res.send(users);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    // Run multiple count queries in parallel for maximum efficiency
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      usersCollection.countDocuments({}), // Counts ALL documents in the users collection
      productsCollection.countDocuments({}),
      ordersCollection.countDocuments({}),
    ]);

    // Send a single, small JSON object with the results
    res.send({
      totalUsers,
      totalProducts,
      totalOrders,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).send({ error: err.message });
  }
});



app.post("/comments", async (req, res) => {
  try {
    const comment = req.body;
    const result = await commentsCollection.insertOne(comment);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/comments", async (req, res) => {
  try {
    
    const { blogId } = req.query;
    let query = {};
    if (blogId) {
      query = { blogId: blogId };
    }

    const result = await commentsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
      
    res.send(result);
  } catch (err) {
    console.error("Error fetching comments:", err); 
    res.status(500).send({ error: err.message });
  }
});

// ---------------------------------NEW------------------------------------------------------

app.get("/api/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const queryFilter = {
      role: 'user', // Only fetch documents with the role 'user'
      ...(search && { name: { $regex: search, $options: "i" } }),
    };

    const [users, totalUsers] = await Promise.all([
      usersCollection.find(queryFilter).skip(skip).limit(limit).toArray(),
      usersCollection.countDocuments(queryFilter),
    ]);

    res.send({
      users,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).send({ error: err.message });
  }
});

// GET /api/staff - Simple endpoint to get ALL staff members (for small lists)
app.get("/api/staff", async (req, res) => {
  try {
    const queryFilter = { role: 'staff' };
    const staff = await usersCollection.find(queryFilter).toArray();
    res.send(staff);
  } catch (err) {
    console.error("Error fetching staff:", err);
    res.status(500).send({ error: err.message });
  }
});

// GET /api/promotable-users - Lightweight endpoint for the AddStaff dropdown
app.get("/api/promotable-users", async (req, res) => {
  try {
    const query = { role: "user" };
    // Projection only sends the fields we absolutely need, making it very fast
    const options = {
      projection: { _id: 1, name: 1, email: 1 },
      sort: { name: 1 } // Sort alphabetically for a better user experience
    };
    const users = await usersCollection.find(query, options).toArray();
    res.send(users);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    // Run multiple count queries in parallel for maximum efficiency
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      usersCollection.countDocuments({}), // Counts ALL documents in the users collection
      productsCollection.countDocuments({}),
      ordersCollection.countDocuments({}),
    ]);

    // Send a single, small JSON object with the results
    res.send({
      totalUsers,
      totalProducts,
      totalOrders,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).send({ error: err.message });
  }
});

// -----------------------------------------------------------------------------------

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


// ----------------- add products related api
app.post(
  "/post-products",
  // Updated multer configuration to handle new and changed fields
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "sizeChartImage", maxCount: 1 }, // Added for size chart
    { name: "galleryImages", maxCount: 50 }, // Increased limit
    { name: "brandLogo", maxCount: 50 }, // Increased limit
    { name: "mainPdf", maxCount: 1 }, // Changed from mainPdfs to mainPdf, limit 1
  ]),
  async (req, res) => {
    try {
      // Destructuring data from request body
      const {
        title,
        productCode,
        GSM_Code,
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
        availabelVarients,
        metaTitle,
        metaDescription,
        description,
        printingEmbroidery,
        textileCare,
      } = req.body;
      
      // Parsing JSON strings from the form data
      const productColors = colors ? JSON.parse(colors) : [];
      const parsedVariants = availabelVarients
        ? JSON.parse(availabelVarients)
        : [];
      const parsedDescription = description ? JSON.parse(description) : null;
      const parsedPrintingEmbroidery = printingEmbroidery
        ? JSON.parse(printingEmbroidery)
        : null;
      const parsedTextileCare = textileCare ? JSON.parse(textileCare) : null;

      // Handling file uploads and generating paths
      const mainImage = req.files["mainImage"]
        ? `/uploads/products/${req.files["mainImage"][0].filename}`
        : null;
        
      // Handling the new single size chart image
      const sizeChartImage = req.files["sizeChartImage"]
        ? `/uploads/products/${req.files["sizeChartImage"][0].filename}`
        : null;

      // Handling multiple gallery images
      const galleryImages = req.files["galleryImages"]
        ? req.files["galleryImages"].map(
            (file) => `/uploads/products/${file.filename}`
          )
        : [];
        
      // Handling multiple brand logos
      const brandLogo = req.files["brandLogo"]
        ? req.files["brandLogo"].map(
            (file) => `/uploads/products/${file.filename}`
          )
        : [];
        
      // Handling the single PDF file (FIXED)
      const mainPdf = req.files["mainPdf"]
        ? `/uploads/products/${req.files["mainPdf"][0].filename}`
        : null;

      // Constructing the final product object for database insertion
      const productData = {
        title,
        metaTitle,
        metaDescription,
        productCode,
        GSM_Code,
        productCategory,
        productSubCategory,
        productSize,
        productColors,
        availabelVarients: parsedVariants,
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
        sizeChartImage, // Added to database object
        galleryImages,
        brandLogo,
        mainPdf, // Updated field name
        createdAt: new Date(),
      };

      // Inserting data into the database
      const result = await productsCollection.insertOne(productData);
      
      // Sending success response
      res.send({
        success: true,
        message: "Product created successfully",
        insertedId: result.insertedId,
      });
    } catch (err) {
      // Handling errors
      console.error("Error saving product:", err);
      res.status(500).send({ success: false, error: err.message });
    }
  }
);

app.get("/find-filterd-products", async (req, res) => {
  try {
    const {
      category,
      subCategory,
      size,
      colour,
      fit,
      gender,
      sustainability,
      search,
      page = 1,  // default 1
      limit = 12 // default 10 per page
    } = req.query;

    let query = {};

    if (category) query.productCategory = { $regex: new RegExp(category, "i") };
    if (subCategory) query.productSubCategory = { $regex: new RegExp(subCategory, "i") };
    if (size) query.productSize = size;
    if (colour) query.productColour = colour;
    if (fit) query.fit = fit;
    if (gender) query.Gender = gender;
    if (sustainability) query.Sustainability = sustainability;
    if (search) query.title = { $regex: new RegExp(search, "i") };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // total products for pagination info
    const totalProducts = await productsCollection.countDocuments(query);

    const result = await productsCollection
      .find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.send({
      data: result,
      total: totalProducts,
      page: parseInt(page),
      pages: Math.ceil(totalProducts / limit)
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});








app.delete("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await productsCollection.deleteOne(query);

    if (result.deletedCount > 0) {
      res.status(200).send({ success: true, message: "Product deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: "Product not found" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).send({ success: false, message: "Failed to delete product" });
  }
});


app.patch(
  "/update-product/:id",
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "brandLogo", maxCount: 10 },
    { name: "mainPdfs", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;


      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid product ID format." });
      }

      const { body, files } = req;
      const updateFields = {};

      // --- Process simple text/select fields from req.body ---
      const simpleFields = [
        "title",
        "metaTitle",
        "productCode",
        "GSM_Code",
        "productCategory",
        "productSubCategory",
        "Sustainability",
        "Gender",
        "productSize",
        "fit",
        "metaDescription",
        "email",
      ];

      simpleFields.forEach((field) => {
        if (body[field] !== undefined && body[field] !== null) {
          updateFields[field] = body[field];
        }
      });

      // --- Process numeric fields ---
      if (body.price !== undefined) {
        updateFields.price = Number(body.price);
      }
      if (body.disCountPrice !== undefined) {
        updateFields.disCountPrice = Number(body.disCountPrice);
      }

      // --- Process stringified JSON fields ---
      try {
        if (body.colors) {
          updateFields.colors = JSON.parse(body.colors);
        }
        if (body.availabelVarients) {
          updateFields.availabelVarients = JSON.parse(body.availabelVarients);
        }
        if (body.description) {
          updateFields.description = JSON.parse(body.description);
        }
        if (body.printingEmbroidery) {
          updateFields.printingEmbroidery = JSON.parse(body.printingEmbroidery);
        }
        if (body.textileCare) {
          updateFields.textileCare = JSON.parse(body.textileCare);
        }
      } catch (jsonError) {
        console.error("JSON Parsing Error:", jsonError);
        return res
          .status(400)
          .send({ success: false, message: "Invalid JSON data format." });
      }

      // --- Process new file uploads (if they exist) ---
      if (files.mainImage) {
        updateFields.mainImage = `/uploads/products/${files.mainImage[0].filename}`;
      }
      if (files.galleryImages && files.galleryImages.length > 0) {
        updateFields.galleryImages = files.galleryImages.map(
          (file) => `/uploads/products/${file.filename}`
        );
      }
      if (files.brandLogo && files.brandLogo.length > 0) {
        updateFields.brandLogo = files.brandLogo.map(
          (file) => `/uploads/products/${file.filename}`
        );
      }
      if (files.mainPdfs && files.mainPdfs.length > 0) {
        updateFields.mainPdfs = files.mainPdfs.map(
          (file) => `/uploads/products/${file.filename}`
        );
      }

      // --- Perform the database update ---
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );

      // --- Check if any document was actually updated ---
      if (result.matchedCount === 0) {
        return res
          .status(404)
          .send({ success: false, message: "Product not found." });
      }

      // --- Send a success response ---
      res.send({ success: true, message: "Product updated successfully!" });
    } catch (err) {
      console.error("Error while updating product:", err);
      res
        .status(500)
        .send({ success: false, message: "An internal server error occurred." });
    }
  }
);

// ----------- product management 
app.post("/post-productAttribute", async (req, res) => {
  try {
    let { key, value } = req.body;
    if (!key || !value) {
      return res.status(400).send({ error: "Key and value are required" });
    }

    let valueToSave = value;
    let query = {};

    if (typeof value === "object" && value !== null && value.colourName) {
      const colourNameToCheck = value.colourName.trim().toLowerCase();

      query = {
        [`productAttributes.${key}.value.colourName`]: {
          $regex: new RegExp(`^${colourNameToCheck}$`, "i"),
        },
      };

      valueToSave = {
        colourName: value.colourName.trim(),
        colourCode: value.colourCode,
      };
    } else if (typeof value === "string") {
      const stringValueToCheck = value.trim().toLowerCase();

      query = {
        [`productAttributes.${key}.value`]: {
          $regex: new RegExp(`^${stringValueToCheck}$`, "i"),
        },
      };

      valueToSave = stringValueToCheck;
    } else {
      return res.status(400).send({ error: "Invalid value format" });
    }

    const exists = await productAttributeCollection.findOne(query);

    if (exists) {
      return res.status(400).send({ error: "This value already exists" });
    }

    const result = await productAttributeCollection.updateOne(
      {},
      {
        $push: {
          [`productAttributes.${key}`]: {
            id: new Date().getTime().toString(),
            value: valueToSave,
          },
        },
      },
      { upsert: true }
    );

    res.send(result);
  } catch (err) {
    console.error("Error in /post-productAttribute:", err);
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

// delete product category
app.delete("/delete-productAttribute/category/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.category": { id: id },
      },
    };

    const result = await productAttributeCollection.updateOne(query, updateDoc);

    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Category deleted successfully",
        modifiedCount: result.modifiedCount,
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Category not found or already deleted",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
});

// delete product sub category
app.delete("/delete-productAttribute/subCategory/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.subCategory": { id: id },
      },
    };

    const result = await productAttributeCollection.updateOne(query, updateDoc);

    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "sub Category deleted successfully",
        modifiedCount: result.modifiedCount,
      });
    } else {
      res.status(404).send({
        success: false,
        message: "sub Category not found or already deleted",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to delete sub Category",
      error: error.message,
    });
  }
});


// delete product color
app.delete("/delete-productAttribute/ProductColour/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.ProductColour": { id: id },
      },
    };

    const result = await productAttributeCollection.updateOne(query, updateDoc);

    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Color deleted successfully",
        modifiedCount: result.modifiedCount,
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Color not found or already deleted",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to delete Color",
      error: error.message,
    });
  }
});

// delete product fit
app.delete("/delete-productAttribute/productFit/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.productFit": { id: id },
      },
    };

    const result = await productAttributeCollection.updateOne(query, updateDoc);

    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Color deleted successfully",
        modifiedCount: result.modifiedCount,
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Color not found or already deleted",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to delete Color",
      error: error.message,
    });
  }
});

// delete product size
app.delete("/delete-productAttribute/productSize/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.productSize": { id: id },
      },
    };

    const result = await productAttributeCollection.updateOne(query, updateDoc);

    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Color deleted successfully",
        modifiedCount: result.modifiedCount,
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Color not found or already deleted",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to delete Color",
      error: error.message,
    });
  }
});

app.get("/find-products", async (req, res) => {
  try {
    const result = await productsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});





// ---------------- product review 
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

app.get("/banners", async (req, res) => {
  try {
    const result = await bannersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/banners", bannerUpload.single("image"), async (req, res) => {
  try {
    const { subtitle, title1, title2, titleBold } = req.body;
    if (!req.file) {
      return res
        .status(400)
        .send({ success: false, error: "Image file is required." });
    }
    const imagePath = `/uploads/banners/${req.file.filename}`;
    const newBannerData = {
      subtitle,
      title1,
      title2,
      titleBold,
      image: imagePath,
      createdAt: new Date(),
    };
    const result = await bannersCollection.insertOne(newBannerData);
    res.send({ success: true, result });
  } catch (err) {
    console.error("Error saving banner:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.delete("/banners/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await bannersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, error: "Banner not found." });
    }
    res.send({ success: true, message: "Banner deleted." });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

app.get("/size-charts", async (req, res) => {
  try {
    const result = await sizeChartsCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.post("/size-charts", uploadSizeChart.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .send({ success: false, error: "Image file is required." });
    }
    const imagePath = `/uploads/size_charts/${req.file.filename}`;
    const newSizeChart = {
      src: imagePath,
      alt: req.body.alt || "Size Chart Image",
      createdAt: new Date(),
    };
    const result = await sizeChartsCollection.insertOne(newSizeChart);
    res.send({ success: true, result });
  } catch (err) {
    console.error("Error saving size chart:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

app.delete("/size-charts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await sizeChartsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, error: "Size chart not found." });
    }
    res.send({ success: true, message: "Size chart deleted." });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});








// ---------------- wishlist 
app.post("/add-wishlist", async (req, res) => {
  try {
    const data = req.body;
    const result = await wishListsCollection.insertOne(data);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/find-wishlist", async (req, res) => {
  try {
    const result = await wishListsCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/find-wishlist/:email", async (req, res) => {
  try {
    const email = req.params.email;


    const wishlistData = await wishListsCollection.find({ email }).toArray();


    const productIds = wishlistData.map(item => new ObjectId(item.productId));


    const products = await productsCollection
      .find({ _id: { $in: productIds } })
      .toArray();


    const result = wishlistData.map(item => {
      const product = products.find(
        p => p._id.toString() === item.productId.toString()
      );
      return {
        ...item,
        productDetails: product || null
      };
    });

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server Error" });
  }
});

// ======================= GEMINI CHATBOT ROUTE =======================
app.post('/api/gemini', async (req, res) => {
  try {
    const { message } = req.body; // Get the message from the request body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    
    // Call the Google Gemini API
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({ error: "No content in response from Gemini." });
    }

    // Send the clean reply back to the frontend
    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Error in /api/gemini route:", error);
    return res.status(500).json({ error: error.message });
  }
});
// =====================================================================

app.post("/send-order-emails", async (req, res) => {
  try {
    const { userName, userEmail, orderInfo } = req.body;
    

    const adminEmail = process.env.ADMIN_EMAIL_RECEIVER; 


    const adminMailOptions = {
      from: `"Aaryan Sourcing Order" <${process.env.GMAIL_USER}>`, 
      to: adminEmail,
      subject: `New Order Alert! - Style: ${orderInfo.styleNumber}`,
      html: `
        <h1>New Order Received</h1>
        <p>A new order has been placed on your website.</p>
        <hr>
        <h3>Order Details:</h3>
        <ul>
          <li><strong>Customer Name:</strong> ${userName}</li>
          <li><strong>Customer Email:</strong> ${userEmail}</li>
          <li><strong>Style Number:</strong> ${orderInfo.styleNumber}</li>
          <li><strong>Company:</strong> ${orderInfo.company}</li>
        </ul>
        <p>Please log in to the admin dashboard for full details.</p>
      `,
    };

    const userMailOptions = {
      from: `"Aaryan Sourcing" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `Your Order is Confirmed (Style: ${orderInfo.styleNumber})`,
      html: `
        <h1>Thank you for your order, ${userName}!</h1>
        <p>We have successfully received your order. Our team will review it and get back to you soon.</p>
        <hr>
        <h3>Your Order Summary:</h3>
        <ul>
          <li><strong>Style Number:</strong> ${orderInfo.styleNumber}</li>
        </ul>
        <p>If you have any questions, feel free to contact us.</p>
        <br>
        <p>Best Regards,</p>
        <p><strong>Aaryan Sourcing Ltd.</strong></p>
      `,
    };


    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(userMailOptions),
    ]);

    res.status(200).send({ success: true, message: "Emails sent successfully." });

  } catch (error) {
    console.error("Error sending emails via Gmail:", error);
    res.status(500).send({ success: false, message: "Failed to send emails." });
  }
});

// --- START OF THE NEW API ROUTE ---
// --- CONFIGURATION FOR YOUR PDFS ---
// 1. Define WHICH columns to show for EACH collection.
const columnConfig = {
  "all-products": {
    headers: ["Title", "Category", "Sub-Category", "Price", "Colors", "Fit"],
    keys: ["title", "productCategory", "productSubCategory", "price", "colors", "fit"],
  },
  "orders": {
    headers: ["Customer Name", "Email", "Phone", "Total", "Date"],
    keys: ["name", "email", "phone", "total", "date"],
  },
  // Add configurations for other collections here as needed
};

// 2. Helper function to format cell content safely
const formatCellContent = (value, key) => {
  // If the value is null or undefined, return an empty string immediately.
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  
  // Custom formatting for the 'colors' array (with safety checks)
  if (key === 'colors' && Array.isArray(value)) {
    const colorNames = value
      .filter(color => color && typeof color.name === 'string') // Keep only valid color objects
      .map(color => color.name); // Get the name from each valid object
    return colorNames.join(', ');
  }
  
  // Custom formatting for dates
  if (['createdAt', 'updatedAt', 'date'].includes(key) && !isNaN(new Date(value))) {
    return new Date(value).toLocaleDateString();
  }

  // Handle other arrays or objects generically
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);

  return value.toString();
};


// --- THE PDF DOWNLOAD API ROUTE ---
app.get("/download-pdf/:collectionName", async (req, res) => {
  const { collectionName } = req.params;
  const config = columnConfig[collectionName];

  if (!config) {
    return res.status(403).send({ error: "PDF generation is not configured for this collection." });
  }

  try {
    const Db = client.db("Ayira-Database");
    const collection = Db.collection(collectionName);
    const data = await collection.find({}).toArray();

    if (data.length === 0) {
      return res.status(404).send({ error: "No documents found in this collection." });
    }

    const body = [
      config.headers.map(header => ({ text: header, style: 'tableHeader' })),
      ...data.map(doc =>
        config.keys.map(key => formatCellContent(doc[key], key))
      )
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      header: {
        columns: [
          { text: 'Aaryan Sourcing Ltd.', alignment: 'left', style: 'documentHeader' },
          { text: 'Confidential Internal Report', alignment: 'right', style: 'documentHeader' }
        ],
        margin: [40, 20, 40, 0]
      },
      footer: function(currentPage, pageCount) {
        return {
          columns: [
            { text: `Generated on: ${new Date().toLocaleString()}`, alignment: 'left', style: 'documentFooter' },
            { text: `Page ${currentPage.toString()} of ${pageCount}`, alignment: 'right', style: 'documentFooter' }
          ],
          margin: [40, 20, 40, 0]
        };
      },
      content: [
        { text: `Data Export: ${collectionName}`, style: 'header' },
        {
          style: 'tableExample',
          table: {
            headerRows: 1,
            widths: Array(config.headers.length).fill('*'),
            body: body,
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex % 2 === 0) ? '#F2F2F2' : null,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#AAAAAA',
            vLineColor: () => '#AAAAAA',
          }
        },
      ],
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 15], alignment: 'center' },
        documentHeader: { fontSize: 10, color: 'gray' },
        documentFooter: { fontSize: 10, color: 'gray' },
        tableExample: { margin: [0, 5, 0, 15] },
        tableHeader: { bold: true, fontSize: 13, color: 'white', fillColor: '#333333' },
      },
      defaultStyle: { font: 'Helvetica' },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    const fileName = `${collectionName}-export-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Failed to generate PDF:", error);
    res.status(500).send({ error: "An internal server error occurred." });
  }
});


// =============================================================================
// ============ PROFESSIONAL SINGLE PRODUCT SHEET PDF ROUTE ============
// =============================================================================

app.get("/download-product-sheet/:id", async (req, res) => {
  const { id } = req.params;

  // Security & Validation: Check if the ID is a valid MongoDB ObjectId
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid product ID format." });
  }

  try {
    const Db = client.db("Ayira-Database");
    const collection = Db.collection("all-products");
    
    // Fetch the single product document from the database
    const product = await collection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).send({ error: "Product not found." });
    }

    // --- Define which fields to display and in what order ---
    const productDetails = [
      { key: 'Product Title', value: product.title },
      { key: 'Product Code', value: product.productCode },
      { key: 'GSM Code', value: product.GSM_Code },
      { key: 'Category', value: product.productCategory },
      { key: 'Sub-Category', value: product.productSubCategory },
      { key: 'Price', value: product.price ? `$${product.price}` : 'N/A' },
      { key: 'Gender', value: product.Gender },
      { key: 'Fit', value: product.fit },
      { key: 'Sustainability', value: product.Sustainability },
      { key: 'Available Colors', value: formatCellContent(product.colors, 'colors') }, // Reuse our safe helper
    ];

    // --- Create the PDF body as a two-column layout ---
    const body = productDetails.map(detail => [
      { text: detail.key, bold: true }, // Key column (e.g., "Title")
      detail.value || 'N/A' // Value column (e.g., "Casual Pants")
    ]);

    // --- Define the Professional PDF document structure ---
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      header: { /* ... same header as before ... */ },
      footer: function(currentPage, pageCount) { /* ... same footer as before ... */ },

      content: [
        { text: 'Product Information Sheet', style: 'header' },
        { text: product.title, style: 'subheader' },
        {
          style: 'detailsTable',
          table: {
            widths: [150, '*'], // First column is fixed width, second takes remaining space
            body: body,
          },
          layout: 'noBorders' // A clean layout with no grid lines
        },
      ],
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5], alignment: 'center' },
        subheader: { fontSize: 16, italics: true, margin: [0, 0, 0, 20], alignment: 'center', color: 'gray' },
        detailsTable: { margin: [0, 5, 0, 15] },
        documentHeader: { fontSize: 10, color: 'gray' },
        documentFooter: { fontSize: 10, color: 'gray' },
      },
      defaultStyle: { font: 'Helvetica' },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    const fileName = `product-sheet-${product.productCode || id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Failed to generate single product PDF:", error);
    res.status(500).send({ error: "An internal server error occurred." });
  }
});


app.listen(port, () => {
  console.log("🚀 ayira server is running on port", port);
});