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

app.get("/orders", async (req, res) => {
  try {
    const result = await ordersCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
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

// Get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const result = await blogsCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
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
    const result = await commentsCollection.find().toArray();
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
