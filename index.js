const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const OpenAI = require("openai");

app.use(express.json());
// app.use(cors({ origin: "http://localhost:3000" }));

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5000",
      "https://ayira-ecommerce-main.vercel.app",
      "https://y-lac-seven.vercel.app",
    ],
  })
);

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

async function run() {
  try {
    // await client.connect();
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

    // await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB!");
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

// app.get("/orders", async (req, res) => {
//   try {
//     const result = await ordersCollection.find().toArray();
//     res.send(result);
//   } catch (err) {
//     res.status(500).send({ error: err.message });
//   }
// });

// =================new order Api================

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

const blogUploadFields = uploadBlog.fields([
  { name: "image", maxCount: 1 },
  { name: "extraImage", maxCount: 1 },
  { name: "authorImage", maxCount: 1 },
]);

// Create blog (UPDATED with Author Image)
app.post("/blogs", blogUploadFields, async (req, res) => {
  try {
    const {
      title,
      category,
      content,
      metaTitle,
      metaDescription,
      shortDescription,
      note,
      tags,
      authorName,
      authorBio,
      authorSocialLink1,
      authorSocialLink2,
      authorSocialLink3,
    } = req.body;

    const blogImage =
      req.files && req.files["image"]
        ? `/uploads/blogs/${req.files["image"][0].filename}`
        : null;
    const extraBlogImage =
      req.files && req.files["extraImage"]
        ? `/uploads/blogs/${req.files["extraImage"][0].filename}`
        : null;
    // NEW: Handle author image file
    const authorImage =
      req.files && req.files["authorImage"]
        ? `/uploads/blogs/${req.files["authorImage"][0].filename}`
        : null;

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
      authorName: authorName || "",
      authorBio: authorBio || "",
      authorImage: authorImage, // NEW: Add author image path
      authorSocialLink1: authorSocialLink1 || "",
      authorSocialLink2: authorSocialLink2 || "",
      authorSocialLink3: authorSocialLink3 || "",
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

// Get all blogs
// ==========add here filter ======================
// app.get("/blogs", async (req, res) => {
//   try {
//     const result = await blogsCollection
//       .find()
//       .sort({ createdAt: -1 })
//       .toArray();
//     res.send(result);
//   } catch (err) {
//     res.status(500).send({ error: err.message });
//   }
// });

// ===============new get api for blog get=========

app.get("/blogs", async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = {};
    if (category && category !== "all") {
      query.category = category;
    }
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }
    const result = await blogsCollection
      .find(query)
      .sort({ createsAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).send({ error: "Failed to fetch blogs." });
  }
});

// =========new code end========

// NEW: Get a single blog by ID
app.get("/blogs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: "Invalid blog ID format." });
    }

    const query = { _id: new ObjectId(id) };
    const blog = await blogsCollection.findOne(query);

    if (!blog) {
      return res.status(404).send({ error: "Blog not found." });
    }

    res.send(blog);
  } catch (err) {
    console.error("Error fetching single blog:", err);
    res.status(500).send({ error: err.message });
  }
});

// Update blog (UPDATED with Author Image)
app.put("/blogs/:id", blogUploadFields, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid blog ID." });
    }

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
      authorName,
      authorBio,
      existingAuthorImage,
      authorSocialLink1,
      authorSocialLink2,
      authorSocialLink3,
    } = req.body;

    const blogImage =
      req.files && req.files["image"]
        ? `/uploads/blogs/${req.files["image"][0].filename}`
        : existingImage || null;
    const extraBlogImage =
      req.files && req.files["extraImage"]
        ? `/uploads/blogs/${req.files["extraImage"][0].filename}`
        : existingExtraImage || null;

    const authorImage =
      req.files && req.files["authorImage"]
        ? `/uploads/blogs/${req.files["authorImage"][0].filename}`
        : existingAuthorImage || null;

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
      authorName,
      authorBio,
      authorImage,
      authorSocialLink1,
      authorSocialLink2,
      authorSocialLink3,
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

app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const result = await categoriesCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});
// ===============================new code
// POST /comments

app.post("/comments", async (req, res) => {
  try {
    const comment = req.body;
    const commentWithTimestamp = {
      ...comment,
      createdAt: new Date(),
    };
    const result = await commentsCollection.insertOne(commentWithTimestamp);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// GET /comments -
app.get("/comments", async (req, res) => {
  try {
    const blogId = req.query.blogId;
    let query = {};
    if (blogId) {
      query = { blogId: blogId };
    }
    const result = await commentsCollection.find(query).toArray();
    res.send(result);
  } catch (err) {
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
      role: "user", // Only fetch documents with the role 'user'
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
    const queryFilter = { role: "staff" };
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
      sort: { name: 1 }, // Sort alphabetically for a better user experience
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

// ------------------------------------------------------------------------------------------------------

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
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
    { name: "brandLogo", maxCount: 10 },
    { name: "mainPdfs", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
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
      const productColors = colors ? JSON.parse(colors) : [];
      const parsedVariants = availabelVarients
        ? JSON.parse(availabelVarients)
        : [];
      const parsedDescription = description ? JSON.parse(description) : null;
      const parsedPrintingEmbroidery = printingEmbroidery
        ? JSON.parse(printingEmbroidery)
        : null;
      const parsedTextileCare = textileCare ? JSON.parse(textileCare) : null;
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
      const mainPdfs = req.files["mainPdfs"]
        ? req.files["mainPdfs"].map(
            (file) => `/uploads/products/${file.filename}`
          )
        : [];
      const productData = {
        title,
        metaTitle,
        metaDescription,
        productCode,
        GSM_Code,
        productCategory,
        productSubCategory,
        productSize,
        colors: productColors,
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
        galleryImages,
        brandLogo,
        mainPdfs,
        createdAt: new Date(),
      };
      const result = await productsCollection.insertOne(productData);
      res.send({
        success: true,
        message: "Product created successfully",
        insertedId: result.insertedId,
      });
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

app.delete("/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

    const result = await productsCollection.deleteOne(query);

    if (result.deletedCount > 0) {
      res
        .status(200)
        .send({ success: true, message: "Product deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: "Product not found" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to delete product" });
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
      res.status(500).send({
        success: false,
        message: "An internal server error occurred.",
      });
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

app.listen(port, () => {
  console.log("🚀 ayira server is running on port", port);
});
