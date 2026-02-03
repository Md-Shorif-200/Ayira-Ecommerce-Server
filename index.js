const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const Pdfmake = require("pdfmake");
const fs = require("fs");
const fetch = require("node-fetch");
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
const cloudinary = require("cloudinary").v2;

// --- Setup & Middleware ---
app.use(express.json());

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5000",
    "https://ayira-ecommerce-1.vercel.app",
    "https://ayira-ecommerce-backend.vercel.app",
  ],
};
app.use(cors(corsOptions));
const io = new Server(server, {
  cors: corsOptions,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new Pdfmake(fonts);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));




// Cloudinary 
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_SECRET 
});


const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete resource ${publicId} from Cloudinary:`, error);
  }
};

const deleteMultipleFromCloudinary = async (resources) => {
  if (!resources || resources.length === 0) return;
  const publicIds = resources.map(res => res.publicId).filter(Boolean);
  if (publicIds.length > 0) {
    try {
      await cloudinary.api.delete_resources(publicIds);
    } catch (error) {
      console.error(`Failed to delete multiple resources from Cloudinary:`, error);
    }
  }
};

// --- Database Connection ---
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
let productAttributeCollection;
let productReviewCollection;
let productsCollection;
let categoriesCollection;
let wishListsCollection;
let conversationsCollection;
let newsLetterCollection;

async function run() {
  try {
    await client.connect();
    const Db = client.db("Ayira-Database");

    sizeChartsCollection = Db.collection("sizeCharts");
    bannersCollection = Db.collection("banners");
    ordersCollection = Db.collection("orders");
    usersCollection = Db.collection("All-Users");
    addressCollection = Db.collection("address");
    productAttributeCollection = Db.collection("Product-Attributes");
    productReviewCollection = Db.collection("Product-Reviews");
    productsCollection = Db.collection("all-products");
    categoriesCollection = Db.collection("categories");
    wishListsCollection = Db.collection("wishlists");
    conversationsCollection = Db.collection("conversations");
    newsLetterCollection = Db.collection("newsLetters");
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error("DB connection failed:", err);
  }
}
run().catch(console.dir);

// --- Root Route ---
app.get("/", (req, res) => {
  res.send("ayira server is running");
});

// --- Live Chat / Conversations ---
app.get("/api/conversations", async (req, res) => {
  try {
    const conversations = await conversationsCollection
      .aggregate([
        { $unwind: "$participants" },
        { $match: { "participants.role": "user" } },
        {
          $lookup: {
            from: "All-Users",
            localField: "participants.userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $project: {
            _id: 1,
            lastMessage: {
              $ifNull: [{ $last: "$messages.content" }, "No messages yet..."],
            },
            lastMessageTimestamp: { $last: "$messages.timestamp" },
            customerName: { $arrayElemAt: ["$userDetails.name", 0] },
            userId: "$participants.userId",
          },
        },
        { $sort: { lastMessageTimestamp: -1 } },
      ])
      .toArray();
    res.send(conversations);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).send({ error: "Failed to fetch conversations." });
  }
});

app.get("/api/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ error: "Invalid user ID format." });
    }
    const conversation = await conversationsCollection.findOne({
      "participants.userId": new ObjectId(userId),
    });
    res.send(conversation ? conversation.messages : []);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).send({ error: "Failed to fetch messages." });
  }
});

// --- Orders ---
app.post("/orders", async (req, res) => {
  try {
    const { captchaToken, ...newOrder } = req.body;

    if (!captchaToken) {
      return res.status(400).json({ message: "CAPTCHA token is missing." });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;

    const verificationResponse = await fetch(verificationUrl, {
      method: "POST",
    });
    const verificationData = await verificationResponse.json();

    if (!verificationData.success) {
      return res
        .status(400)
        .json({ message: "CAPTCHA verification failed. Please try again." });
    }

    const result = await ordersCollection.insertOne(newOrder);
    res.status(201).send(result);
  } catch (err) {
    console.error("Error creating order:", err);
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

app.get("/order", async (req, res) => {
  try {
    const { search, email, page = 1, limit = 3 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    let query = {};
    if (email) {
      query.email = email;
    } else if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    const [orders, totalOrders] = await Promise.all([
      ordersCollection
        .find(query)
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      ordersCollection.countDocuments(query),
    ]);
    res.send({
      orders,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).send({ error: "Failed to fetch orders." });
  }
});

app.delete("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, error: "Invalid order ID format." });
    }
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, error: "Order not found." });
    }
    res.send({ success: true, message: "Order deleted successfully." });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).send({ success: false, error: "Failed to delete order." });
  }
});

// --- File Uploads (Multer) ---
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

// --- Categories ---
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

app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const result = await categoriesCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

// --- Users ---
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
      role: user.role || "user",
      permissions: user.permissions || [],
    };

    const result = await usersCollection.insertOne(userWithDefaults);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const query = { email: email };
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
    const count = await usersCollection.countDocuments();
    res.send({ length: count });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const queryFilter = {
      role: "user",
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

// --- Dashboard Stats ---
app.get("/api/stats", async (req, res) => {
  try {
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      usersCollection.countDocuments({}),
      productsCollection.countDocuments({}),
      ordersCollection.countDocuments({}),
    ]);
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

// --- Address ---
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

// --- Products ---
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


//-----------------  product post api

app.post(
  "/post-products",
  async (req, res) => {
    console.log("--- Received Request Body (JSON Payload) ---");
    console.log(req.body); 

    try {

      const {
        title,
        productCode,
        GSM_Code,
        productCategory,
        productSubCategory,
        productStatus,
        productSize,
        colors, 
        fit,
        Sustainability,
        brand,
        price,
        disCountPrice,
        email,
        availabelVarients,
        description,
        printingEmbroidery,
        textileCare, 
        shortDescription,
        genderSizing,
        // Media URLs sent from the client
        mainImage, 
        sizeChartImage, 
        galleryImages, 
        brandLogo, 
        mainPdf, 
        metaTitle,
        metaDescription,
        metaKeywords,
        mainImageAltText,
        metaRobots,
        openGraphTitle,
        openGraphDescription,
        twitterTitle,
        twitterDescription,
        facebookUrl,
        twitterUrl,
        instagramUrl,
        linkedInUrl,

    
        metaImage,
      } = req.body;
      
    
      const productData = {
        email,
        title,
        productCode,
        GSM_Code,
        productCategory,
        productSubCategory,
        productStatus,
        productSize,
        fit,
        brand,
        price: Number(price),
        disCountPrice: disCountPrice ? Number(disCountPrice) : null,
        Sustainability,
        shortDescription,
        
        // --- SEO and Meta Data ---
        metaTitle,
        metaDescription,
        metaKeywords,
        mainImageAltText,
        metaRobots,
        openGraphTitle,
        openGraphDescription,
        twitterTitle,
        twitterDescription,
        socialMedia: {
          facebook: facebookUrl,
          twitter: twitterUrl,
          instagram: instagramUrl,
          linkedIn: linkedInUrl,
        },

        mainImage, 
        metaImage, 
        sizeChartImage, 
        galleryImages, 
        brandLogo, 
        mainPdf, 
        
        createdAt: new Date(),
        
        // --- Structured Data ---
        colors: colors || [],
        genderSizing: genderSizing || [],
        availabelVarients: availabelVarients || [],
        description: description || null,
        printingEmbroidery: printingEmbroidery || null,
        textileCare: textileCare || null,
      };

      // Insert the data into the products collection
      const result = await productsCollection.insertOne(productData);
      
      res.status(201).send({ // 201 Created is more appropriate for successful creation
        success: true,
        message: "Product created successfully",
        insertedId: result.insertedId,
      });

    } catch (err) {
      console.error("Error saving product:", err);
      res.status(500).send({ success: false, error: "Internal server error while saving the product." });
    }
  }
);

app.get("/find-filterd-products", async (req, res) => {
  try {
    const {
      category,
      subCategory,
      size,
      gender,
      colour,
      fit,
      sustainability,
      search,
      brand,
      page = 1,
      limit = 12,
    } = req.query;
    let query = {};
    if (category) query.productCategory = { $regex: new RegExp(category, "i") };
    if (subCategory)
      query.productSubCategory = { $regex: new RegExp(subCategory, "i") };
    if (colour) query.productColour = colour;
    if (fit) query.fit = fit;
    if (sustainability) query.Sustainability = sustainability;
    if (brand) query.brand = brand;
    if (search) query.title = { $regex: new RegExp(search, "i") };
    if (size && gender) {
      query.genderSizing = {
        $elemMatch: {
          gender: { $regex: new RegExp(gender, "i") },
          sizes: size,
        },
      };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
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
      pages: Math.ceil(totalProducts / limit),
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


app.patch("/update-product/:id", async (req, res) => {
    console.log('------------------- update product')
    console.log(req.body)
  try {
    const { id } = req.params;
    const updateData = req.body; 

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ success: false, message: "Invalid product ID format." });
    }

    const existingProduct = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingProduct) {
      return res.status(404).send({ success: false, message: "Product not found." });
    }

    // Single file fields
    if (updateData.mainImagePublicId && existingProduct.mainImagePublicId) {
      await deleteFromCloudinary(existingProduct.mainImagePublicId);
    }
    if (updateData.sizeChartImagePublicId && existingProduct.sizeChartImagePublicId) {
      await deleteFromCloudinary(existingProduct.sizeChartImagePublicId);
    }
    if (updateData.metaImagePublicId && existingProduct.metaImagePublicId) {
      await deleteFromCloudinary(existingProduct.metaImagePublicId);
    }
    if (updateData.mainPdfPublicId && existingProduct.mainPdfPublicId) {
      await deleteFromCloudinary(existingProduct.mainPdfPublicId);
    }

    // Multiple file fields
    if (updateData.galleryImages && existingProduct.galleryImages?.length > 0) {
      await deleteMultipleFromCloudinary(existingProduct.galleryImages);
    }
    if (updateData.brandLogos && existingProduct.brandLogos?.length > 0) {
      await deleteMultipleFromCloudinary(existingProduct.brandLogos);
    }

    const updateFields = { ...updateData };
    

    if (updateFields.price) updateFields.price = Number(updateFields.price);
    if (updateFields.disCountPrice) updateFields.disCountPrice = Number(updateFields.disCountPrice);

  
    if (updateFields.description) {
  
    }

    if (updateData.facebookUrl || updateData.twitterUrl || updateData.instagramUrl || updateData.linkedInUrl) {
      updateFields.socialMedia = {
        facebook: updateData.facebookUrl || existingProduct.socialMedia?.facebook || "",
        twitter: updateData.twitterUrl || existingProduct.socialMedia?.twitter || "",
        instagram: updateData.instagramUrl || existingProduct.socialMedia?.instagram || "",
        linkedIn: updateData.linkedInUrl || existingProduct.socialMedia?.linkedIn || "",
      };

      delete updateFields.facebookUrl;
      delete updateFields.twitterUrl;
      delete updateFields.instagramUrl;
      delete updateFields.linkedInUrl;
    }

    updateFields.updatedAt = new Date();


    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "Product not found during update." });
    }

    res.send({
      success: true,
      message: "Product updated successfully!",
      modifiedCount: result.modifiedCount,
    });

  } catch (err) {
    console.error("Error while updating product:", err);
    res.status(500).send({
      success: false,
      message: err.message || "An internal server error occurred.",
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

app.get("/find-single-products/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await productsCollection.findOne(query);
  res.send(result);
});

// --- Product Attributes ---
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
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
});

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
        message: "Sub-category deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Sub-category not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete sub-category",
      error: error.message,
    });
  }
});

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
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Color not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete color",
      error: error.message,
    });
  }
});

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
        message: "Product fit deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Product fit not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete product fit",
      error: error.message,
    });
  }
});

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
        message: "Product size deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Product size not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete product size",
      error: error.message,
    });
  }
});

app.delete("/delete-productAttribute/brand/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.brand": { id: id },
      },
    };
    const result = await productAttributeCollection.updateOne(query, updateDoc);
    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Brand deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Brand not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete brand",
      error: error.message,
    });
  }
});

app.delete("/delete-productAttribute/sustainability/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = {};
    const updateDoc = {
      $pull: {
        "productAttributes.sustainability": { id: id },
      },
    };
    const result = await productAttributeCollection.updateOne(query, updateDoc);
    if (result.modifiedCount > 0) {
      res.send({
        success: true,
        message: "Sustainability attribute deleted successfully",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Sustainability attribute not found",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to delete sustainability attribute",
      error: error.message,
    });
  }
});

// --- Product Reviews ---
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

// --- Banners ---
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

// --- Wishlist ---
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

app.delete("/delete-wishlist/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await wishListsCollection.deleteOne(query);
  res.send(result);
});

// --- Special Product Lists ---
app.get("/featured-products", async (req, res) => {
  try {
    const featuredProducts = await productsCollection
      .find({ productStatus: "featured" })
      .toArray();
    res.json(featuredProducts);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/new-arrivals", async (req, res) => {
  try {
    const newArrivals = await productsCollection
      .find({ productStatus: "new_arrivals" })
      .toArray();
    res.json(newArrivals);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/trending", async (req, res) => {
  try {
    const trendingProducts = await productsCollection
      .find({ productStatus: "trending" })
      .toArray();
    res.json(trendingProducts);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Email Notifications ---
app.post("/send-order-emails", async (req, res) => {
  try {
    const { userName, userEmail, orderInfo } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL_RECEIVER;

    const adminMailOptions = {
      from: `Aaryan Sourcing Order <${process.env.GMAIL_USER}>`,
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
      from: `Aaryan Sourcing <${process.env.GMAIL_USER}>`,
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

    res
      .status(200)
      .send({ success: true, message: "Emails sent successfully." });
  } catch (error) {
    console.error("Error sending emails via Gmail:", error);
    res.status(500).send({ success: false, message: "Failed to send emails." });
  }
});

// --- PDF Generation ---
const columnConfig = {
  "all-products": {
    headers: ["Title", "Category", "Sub-Category", "Price", "Colors", "Fit"],
    keys: [
      "title",
      "productCategory",
      "productSubCategory",
      "price",
      "colors",
      "fit",
    ],
  },
  orders: {
    headers: ["Customer Name", "Email", "Phone", "Total", "Date"],
    keys: ["name", "email", "phone", "total", "date"],
  },
};

const formatCellContent = (value, key) => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (key === "colors" && Array.isArray(value)) {
    const colorNames = value
      .filter((color) => color && typeof color.name === "string")
      .map((color) => color.name);
    return colorNames.join(", ");
  }
  if (
    ["createdAt", "updatedAt", "date"].includes(key) &&
    !isNaN(new Date(value))
  ) {
    return new Date(value).toLocaleDateString();
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);

  return value.toString();
};

app.get("/download-pdf/:collectionName", async (req, res) => {
  const { collectionName } = req.params;
  const config = columnConfig[collectionName];

  if (!config) {
    return res
      .status(403)
      .send({ error: "PDF generation is not configured for this collection." });
  }
  try {
    const Db = client.db("Ayira-Database");
    const collection = Db.collection(collectionName);
    const data = await collection.find({}).toArray();

    if (data.length === 0) {
      return res
        .status(404)
        .send({ error: "No documents found in this collection." });
    }

    const body = [
      config.headers.map((header) => ({ text: header, style: "tableHeader" })),
      ...data.map((doc) =>
        config.keys.map((key) => formatCellContent(doc[key], key))
      ),
    ];

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [40, 60, 40, 60],
      header: {
        columns: [
          {
            text: "Aaryan Sourcing Ltd.",
            alignment: "left",
            style: "documentHeader",
          },
          {
            text: "Confidential Internal Report",
            alignment: "right",
            style: "documentHeader",
          },
        ],
        margin: [40, 20, 40, 0],
      },
      footer: function (currentPage, pageCount) {
        return {
          columns: [
            {
              text: `Generated on: ${new Date().toLocaleString()}`,
              alignment: "left",
              style: "documentFooter",
            },
            {
              text: `Page ${currentPage.toString()} of ${pageCount}`,
              alignment: "right",
              style: "documentFooter",
            },
          ],
          margin: [40, 20, 40, 0],
        };
      },
      content: [
        { text: `Data Export: ${collectionName}`, style: "header" },
        {
          style: "tableExample",
          table: {
            headerRows: 1,
            widths: Array(config.headers.length).fill("*"),
            body: body,
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex % 2 === 0 ? "#F2F2F2" : null),
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#AAAAAA",
            vLineColor: () => "#AAAAAA",
          },
        },
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 15],
          alignment: "center",
        },
        documentHeader: { fontSize: 10, color: "gray" },
        documentFooter: { fontSize: 10, color: "gray" },
        tableExample: { margin: [0, 5, 0, 15] },
        tableHeader: {
          bold: true,
          fontSize: 13,
          color: "white",
          fillColor: "#333333",
        },
      },
      defaultStyle: { font: "Helvetica" },
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const fileName = `${collectionName}-export-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    res.status(500).send({ error: "An internal server error occurred." });
  }
});

app.get("/download-product-sheet/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ error: "Invalid product ID format." });
  }

  try {
    const Db = client.db("Ayira-Database");
    const collection = Db.collection("all-products");
    const product = await collection.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).send({ error: "Product not found." });
    }
    const productDetails = [
      { key: "Product Title", value: product.title },
      { key: "Product Code", value: product.productCode },
      { key: "GSM Code", value: product.GSM_Code },
      { key: "Category", value: product.productCategory },
      { key: "Sub-Category", value: product.productSubCategory },
      { key: "Price", value: product.price ? `$${product.price}` : "N/A" },
      { key: "Gender", value: product.Gender },
      { key: "Fit", value: product.fit },
      { key: "Sustainability", value: product.Sustainability },
      {
        key: "Available Colors",
        value: formatCellContent(product.colors, "colors"),
      },
    ];
    const body = productDetails.map((detail) => [
      { text: detail.key, bold: true },
      detail.value || "N/A",
    ]);
    const docDefinition = {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      header: {},
      footer: function (currentPage, pageCount) {},

      content: [
        { text: "Product Information Sheet", style: "header" },
        { text: product.title, style: "subheader" },
        {
          style: "detailsTable",
          table: {
            widths: [150, "*"],
            body: body,
          },
          layout: "noBorders",
        },
      ],
      styles: {
        header: {
          fontSize: 22,
          bold: true,
          margin: [0, 0, 0, 5],
          alignment: "center",
        },
        subheader: {
          fontSize: 16,
          italics: true,
          margin: [0, 0, 0, 20],
          alignment: "center",
          color: "gray",
        },
        detailsTable: { margin: [0, 5, 0, 15] },
        documentHeader: { fontSize: 10, color: "gray" },
        documentFooter: { fontSize: 10, color: "gray" },
      },
      defaultStyle: { font: "Helvetica" },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const fileName = `product-sheet-${product.productCode || id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Failed to generate single product PDF:", error);
    res.status(500).send({ error: "An internal server error occurred." });
  }
});



// --- Newsletter ---
app.post("/post-newsletter", async (req, res) => {
  const data = req.body;
  const existingEmail = await newsLetterCollection.findOne({
    email: data.email,
  });

  if (existingEmail) {
    return res
      .status(409)
      .send({ acknowledged: false, message: "This email already exists" });
  }
  const result = await newsLetterCollection.insertOne(data);
  res.send(result);
});

app.get("/find-newsletter", async (req, res) => {
  const result = await newsLetterCollection.find().toArray();
  res.send(result);
});

app.delete("/delete-newsletter/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await newsLetterCollection.deleteOne(query);
  res.send(result);
});

// --- Start Server ---
server.listen(port, () => {
  console.log("ayira server is running on port", port);
});