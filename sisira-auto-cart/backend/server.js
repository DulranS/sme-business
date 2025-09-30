// server.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");
require("dotenv").config();

// Endpoint logger middleware

// Enhanced Cloudinary Public ID extraction function
const extractCloudinaryPublicId = (url) => {
  if (!url || typeof url !== "string") return null;

  // Better regex to handle various Cloudinary URL formats
  const match = url.match(/\/v\d+\/([^/]+\/[^.]+|[^/]+)(?:\.\w+)?$/);
  return match ? match[1] : null;
};

// Initialize Firebase with proper credential handling
let firebaseCredential;
if (process.env.NODE_ENV === "production") {
  // Use application default credentials in production
  firebaseCredential = admin.credential.applicationDefault();
} else {
  // In development, use service account if available or try application default
  try {
    const serviceAccount = require("./serviceAccountKey.json");
    firebaseCredential = admin.credential.cert(serviceAccount);
  } catch (error) {
    console.warn(
      "Service account file not found, using application default credentials"
    );
    firebaseCredential = admin.credential.applicationDefault();
  }
}

admin.initializeApp({
  credential: firebaseCredential,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const productsCollection = db.collection("products");

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 5000;
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Middleware
app.use(
  cors({
    origin: "https://sisiraautoparts.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json("Welcome to the Sisira Auto Parts API!");
});
// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "auto-parts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  },
});

// Create multer upload instance with Cloudinary storage
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }

    cb(new Error("Only image files are allowed!"));
  },
});

// Helper to convert Firestore documents to product objects
// Updated to match frontend Product interface
const convertDocToProduct = (doc) => {
  if (!doc || !doc.exists) return null;

  const data = doc.data();
  if (!data) return null;

  // Handle vehicleType to ensure it's an array as expected by frontend
  let vehicleType = data.vehicleType || [];
  if (!Array.isArray(vehicleType)) {
    vehicleType = vehicleType ? [vehicleType] : [];
  }

  // Safely convert date fields
  let createdAt, updatedAt;

  // Check if createdAt exists and has toDate method (Firestore Timestamp)
  if (data.createdAt && typeof data.createdAt.toDate === "function") {
    createdAt = data.createdAt.toDate();
  } else if (data.createdAt instanceof Date) {
    createdAt = data.createdAt;
  } else {
    createdAt = new Date(); // Default
  }

  // Same for updatedAt
  if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
    updatedAt = data.updatedAt.toDate();
  } else if (data.updatedAt instanceof Date) {
    updatedAt = data.updatedAt;
  } else {
    updatedAt = new Date(); // Default
  }

  return {
    id: doc.id,
    ...data,
    vehicleType,
    // Convert fields to match frontend
    price: Number(data.price || 0),
    stockQuantity: Number(data.stockQuantity || data.stock || 0),
    featured: Boolean(data.featured || false),
    // Ensure these frontend-specific fields exist
    brand: data.brand || "",
    partNumber: data.partNumber || "",
    subcategory: data.subcategory || "",
    discountPercentage: Number(data.discountPercentage || 0),
    createdAt,
    updatedAt,
  };
};
// Function to verify a product exists
async function verifyProductExists(id) {
  const docRef = productsCollection.doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error(`Product with ID ${id} does not exist`);
  }

  return doc;
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "production" ? "An error occurred" : err.message,
  });
};

// API Routes
// -------------------------------------------

const inventoryNotificationsCollection = db.collection(
  "inventory-notifications"
);
app.post("/api/inventory-notifications", async (req, res) => {
  try {
    const { contact, productId } = req.body;

    if (!contact) {
      return res.status(400).json({
        message: "Contact information (email or phone number) is required",
      });
    }

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
      });
    }

    // Verify product exists and get product details
    try {
      const productDoc = await verifyProductExists(productId);
      const productData = convertDocToProduct(productDoc);

      // Create notification record
      const notificationData = {
        contact,
        productId,
        productName: productData.name,
        productSku: productData.sku || productData.partNumber || "N/A",
        productBrand: productData.brand || "N/A",
        productCategory: productData.category,
        productSubcategory: productData.subcategory || "N/A",
        notifiedAt: null, // Will be set when notification is sent
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        hasBeenNotified: false,
      };

      // Check if this contact already requested notification for this product
      const existingQuery = await inventoryNotificationsCollection
        .where("contact", "==", contact)
        .where("productId", "==", productId)
        .where("hasBeenNotified", "==", false)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // Already exists, just update the timestamp
        const docRef = existingQuery.docs[0].ref;
        await docRef.update({
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          message: "You're already on the notification list for this product",
          id: docRef.id,
        });
      }

      // Create new notification request
      const docRef = await inventoryNotificationsCollection.add(
        notificationData
      );

      res.status(201).json({
        message: "You'll be notified when this product is back in stock",
        id: docRef.id,
      });
    } catch (error) {
      if (error.message && error.message.includes("does not exist")) {
        return res.status(404).json({ message: "Product not found" });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating inventory notification:", error);
    res.status(500).json({
      message: "Failed to register for inventory notification",
      error: error.message,
    });
  }
});

// Endpoint to get all pending notifications for a specific product
app.get("/api/products/:id/inventory-notifications", async (req, res) => {
  try {
    const productId = req.params.id;

    // Check if product exists
    try {
      await verifyProductExists(productId);
    } catch (error) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get all pending notifications for this product
    const snapshot = await inventoryNotificationsCollection
      .where("productId", "==", productId)
      .where("hasBeenNotified", "==", false)
      .orderBy("createdAt", "desc")
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt && doc.data().createdAt.toDate(),
    }));

    res.status(200).json({
      productId,
      notificationCount: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching inventory notifications:", error);
    res.status(500).json({ message: error.message });
  }
});

// Endpoint to mark notifications as sent when product is back in stock
// This would typically be called by an admin or automated system
app.post("/api/products/:id/send-inventory-notifications", async (req, res) => {
  try {
    const productId = req.params.id;

    // Verify product exists and is in stock
    try {
      const productDoc = await verifyProductExists(productId);
      const productData = productDoc.data();

      if (!productData.stockQuantity || productData.stockQuantity <= 0) {
        return res.status(400).json({
          message:
            "Cannot send notifications when product is still out of stock",
        });
      }
    } catch (error) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Get all pending notifications
    const snapshot = await inventoryNotificationsCollection
      .where("productId", "==", productId)
      .where("hasBeenNotified", "==", false)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        message: "No pending notifications for this product",
        count: 0,
      });
    }

    // Update all notifications in batches (Firestore has a limit of 500 operations per batch)
    const batchSize = 500;
    let totalProcessed = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = snapshot.docs.slice(i, i + batchSize);

      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          hasBeenNotified: true,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      totalProcessed += chunk.length;
    }

    res.status(200).json({
      message: `Successfully marked ${totalProcessed} notifications as sent`,
      count: totalProcessed,
    });
  } catch (error) {
    console.error("Error sending inventory notifications:", error);
    res.status(500).json({ message: error.message });
  }
});

// Add this to your admin dashboard - get all notifications (with pagination)
app.get("/api/inventory-notifications", async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      productId,
      notified = "all", // 'all', 'true', 'false'
    } = req.query;

    const pageSize = parseInt(limit);
    const currentPage = parseInt(page);

    if (
      isNaN(pageSize) ||
      isNaN(currentPage) ||
      pageSize <= 0 ||
      currentPage <= 0
    ) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // Build query
    let query = inventoryNotificationsCollection.orderBy("createdAt", "desc");

    // Filter by product if specified
    if (productId) {
      query = query.where("productId", "==", productId);
    }

    // Filter by notification status if specified
    if (notified === "true") {
      query = query.where("hasBeenNotified", "==", true);
    } else if (notified === "false") {
      query = query.where("hasBeenNotified", "==", false);
    }

    // Get total count
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // Apply pagination
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedQuery = query.limit(pageSize).offset(startIndex);
    const paginatedSnapshot = await paginatedQuery.get();

    const notifications = paginatedSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt && doc.data().createdAt.toDate(),
      notifiedAt: doc.data().notifiedAt && doc.data().notifiedAt.toDate(),
    }));

    res.status(200).json({
      notifications,
      pagination: {
        total: totalCount,
        page: currentPage,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching inventory notifications:", error);
    res.status(500).json({ message: error.message });
  }
});

// Improved image upload endpoint with better validation and response
app.post("/api/upload-images", upload.array("images", 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const imageUrls = req.files
      .map((file) => {
        if (!file.path) {
          console.warn("File uploaded but no path returned:", file);
          return null;
        }
        return file.path;
      })
      .filter(Boolean);

    if (imageUrls.length === 0) {
      return res.status(500).json({
        message: "Files were uploaded but no valid URLs were generated",
      });
    }

    res.status(200).json({
      imageUrls,
      count: imageUrls.length,
      message: `Successfully uploaded ${imageUrls.length} image(s)`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Enhanced product creation with transaction and error handling
// Updated to handle frontend Product interface fields
app.post("/api/products", async (req, res) => {
  try {
    const { name, price, category, subcategory, description, images } =
      req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    // Validate images if provided
    if (images) {
      if (!Array.isArray(images)) {
        return res.status(400).json({ message: "Images must be an array" });
      }

      // Validate that all image URLs look like Cloudinary URLs
      const invalidImages = images.filter(
        (url) => !url.includes("cloudinary.com/")
      );
      if (invalidImages.length > 0) {
        return res.status(400).json({
          message: "Some image URLs are not valid Cloudinary URLs",
          invalidImages,
        });
      }
    }

    // Handle vehicleType - ensure it's an array as expected by frontend
    let vehicleType = req.body.vehicleType || [];
    if (!Array.isArray(vehicleType)) {
      vehicleType = vehicleType ? [vehicleType] : [];
    }

    const productData = {
      ...req.body,
      vehicleType,
      price: Number(req.body.price),
      stockQuantity: Number(req.body.stockQuantity || req.body.stock || 0),
      featured: Boolean(req.body.featured || false),
      // Ensure required frontend fields exist
      brand: req.body.brand || "",
      partNumber: req.body.partNumber || "",
      subcategory: req.body.subcategory || "",
      discountPercentage: Number(req.body.discountPercentage || 0),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Use a transaction to ensure atomicity
    const productId = await db.runTransaction(async (transaction) => {
      const docRef = productsCollection.doc();
      transaction.set(docRef, productData);
      return docRef.id;
    });

    // Fetch the newly created product
    const doc = await productsCollection.doc(productId).get();

    res.status(201).json({
      ...convertDocToProduct(doc),
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({
      message: "Failed to create product",
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
    });
  }
});

// Get all products from Firebase with pagination and filtering
// Updated to handle frontend-specific filters
app.get("/api/products", async (req, res) => {
  try {
    const {
      limit = 50,
      page = 1,
      category,
      subcategory, // Added for frontend
      brand, // Added for frontend
      featured,
      search,
      vehicleType, // Will handle array match
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const pageSize = parseInt(limit);
    const currentPage = parseInt(page);

    if (
      isNaN(pageSize) ||
      isNaN(currentPage) ||
      pageSize <= 0 ||
      currentPage <= 0
    ) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // We'll always filter in memory for frontend alignment because:
    // 1. vehicleType needs array contains handling
    // 2. We have multiple potential filter fields
    const shouldFilterInMemory = true;

    // Get all products first for in-memory filtering
    const allDocsSnapshot = await productsCollection.get();
    const allProducts = allDocsSnapshot.docs
      .map(convertDocToProduct)
      .filter(Boolean);

    // Apply filters in memory
    let filteredProducts = allProducts;

    // Apply category filter
    if (category) {
      filteredProducts = filteredProducts.filter(
        (p) => p.category === category
      );
    }

    // Apply subcategory filter (new)
    if (subcategory) {
      filteredProducts = filteredProducts.filter(
        (p) => p.subcategory === subcategory
      );
    }

    // Apply brand filter (new)
    if (brand) {
      filteredProducts = filteredProducts.filter((p) => p.brand === brand);
    }

    // Apply vehicleType filter - handle array contains match
    if (vehicleType) {
      filteredProducts = filteredProducts.filter(
        (p) =>
          Array.isArray(p.vehicleType) && p.vehicleType.includes(vehicleType)
      );
    }

    if (featured === "false") {
      filteredProducts = filteredProducts.filter((p) => p.featured === false);
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.name?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower) ||
          product.partNumber?.toLowerCase().includes(searchLower) ||
          product.brand?.toLowerCase().includes(searchLower)
      );
    }

    // Sort in memory
    filteredProducts.sort((a, b) => {
      // Handle special sort fields
      if (sortBy === "price") {
        if (order === "asc") {
          return a.price - b.price;
        } else {
          return b.price - a.price;
        }
      } else if (sortBy === "name") {
        if (order === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      } else {
        // Default sorting by date fields
        const aValue = a[sortBy] || new Date(0);
        const bValue = b[sortBy] || new Date(0);

        if (order === "asc") {
          return aValue < bValue ? -1 : 1;
        } else {
          return aValue > bValue ? -1 : 1;
        }
      }
    });

    const totalCount = filteredProducts.length;

    // Apply pagination in memory
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedProducts = filteredProducts.slice(
      startIndex,
      startIndex + pageSize
    );

    res.status(200).json({
      products: paginatedProducts,
      pagination: {
        total: totalCount,
        page: currentPage,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get featured products endpoint
app.get("/api/featured-products", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const category = req.query.category;
    const vehicleType = req.query.vehicleType;
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order || "desc";

    if (isNaN(limit) || isNaN(page) || limit <= 0 || page <= 0) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // Start with a query for featured products
    let query = productsCollection.where("featured", "==", true);

    // Apply category filter directly in Firestore query if provided
    if (category) {
      query = query.where("category", "==", category);
    }

    // For vehicleType, we can use an array-contains query if your data model supports it
    // This is more efficient than in-memory filtering
    if (vehicleType) {
      query = query.where("vehicleType", "array-contains", vehicleType);
    }

    // For sortable fields that we can handle in Firestore
    if (["name", "price", "createdAt"].includes(sortBy)) {
      query = query.orderBy(sortBy, order);
    }

    // First get the total count of matching documents
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    // Then apply pagination and get the actual documents
    const startIndex = (page - 1) * limit;
    const paginatedQuery = query.limit(limit).offset(startIndex);
    const paginatedSnapshot = await paginatedQuery.get();

    const products = paginatedSnapshot.docs
      .map(convertDocToProduct)
      .filter(Boolean);

    // If we're sorting by a field that Firestore can't handle, do it in memory
    if (!["name", "price", "createdAt"].includes(sortBy)) {
      products.sort((a, b) => {
        const aValue = a[sortBy] || (sortBy.includes("At") ? new Date(0) : 0);
        const bValue = b[sortBy] || (sortBy.includes("At") ? new Date(0) : 0);

        if (order === "asc") {
          return aValue < bValue ? -1 : 1;
        } else {
          return aValue > bValue ? -1 : 1;
        }
      });
    }

    res.status(200).json({
      products,
      pagination: {
        total: totalCount,
        page,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get product by ID from Firebase
app.get("/api/products/:id", async (req, res) => {
  try {
    const doc = await productsCollection.doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json(convertDocToProduct(doc));
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update product in Firebase - updated for frontend Product interface
app.put("/api/products/:id", async (req, res) => {
  try {
    const productRef = productsCollection.doc(req.params.id);
    const doc = await productRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Handle vehicleType - ensure it's an array
    let vehicleType = req.body.vehicleType || [];
    if (!Array.isArray(vehicleType)) {
      vehicleType = vehicleType ? [vehicleType] : [];
    }

    // Prepare update data
    const updateData = {
      ...req.body,
      vehicleType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Convert numeric fields
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }

    if (updateData.stockQuantity !== undefined) {
      updateData.stockQuantity = Number(updateData.stockQuantity);
    } else if (updateData.stock !== undefined) {
      // Handle both stockQuantity and legacy stock field
      updateData.stockQuantity = Number(updateData.stock);
      delete updateData.stock;
    }

    if (updateData.discountPercentage !== undefined) {
      updateData.discountPercentage = Number(updateData.discountPercentage);
    }

    if (updateData.featured !== undefined) {
      updateData.featured = Boolean(updateData.featured);
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    await productRef.update(updateData);

    const updatedDoc = await productRef.get();
    res.status(200).json(convertDocToProduct(updatedDoc));
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(400).json({ message: error.message });
  }
});

// Enhanced product deletion with better Cloudinary cleanup
app.delete("/api/products/:id", async (req, res) => {
  try {
    const productRef = productsCollection.doc(req.params.id);
    const doc = await productRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const productData = doc.data();
    const productId = doc.id;
    const deletedImages = [];
    const failedImages = [];

    // Delete associated images from Cloudinary
    if (productData.images && productData.images.length > 0) {
      try {
        const deletePromises = productData.images.map(async (url) => {
          const publicId = extractCloudinaryPublicId(url);

          if (publicId) {
            try {
              const result = await cloudinary.uploader.destroy(publicId);
              deletedImages.push(publicId);
              return result;
            } catch (err) {
              console.error(
                `Failed to delete Cloudinary image ${publicId}:`,
                err
              );
              failedImages.push({ url, publicId, error: err.message });
              return null;
            }
          }
          return null;
        });

        await Promise.allSettled(deletePromises);
      } catch (deleteErr) {
        console.error("Error deleting Cloudinary images:", deleteErr);
      }
    }

    // Now delete the product document
    await productRef.delete();

    res.status(200).json({
      message: "Product deleted successfully",
      id: productId,
      imagesDeleted: deletedImages.length,
      imagesFailed: failedImages.length > 0 ? failedImages : undefined,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get vehicle types endpoint - updated to match frontend VehicleType
app.get("/api/vehicle-types", async (req, res) => {
  try {
    // Get distinct vehicle types from products
    const snapshot = await productsCollection.select("vehicleType").get();
    const vehicleTypes = new Set();

    snapshot.docs.forEach((doc) => {
      const vehicleType = doc.data().vehicleType;
      if (vehicleType) {
        if (Array.isArray(vehicleType)) {
          vehicleType.forEach((type) => {
            if (type) vehicleTypes.add(type);
          });
        } else if (typeof vehicleType === "string") {
          vehicleTypes.add(vehicleType);
        }
      }
    });

    // Filter to match frontend VehicleType enum if needed
    const validVehicleTypes = [
      "Sedan",
      "SUV",
      "Truck",
      "Van",
      "Motorcycle",
      "Hatchback",
      "Commercial",
    ];

    // Either return all found types or filter to only valid types
    const result = Array.from(vehicleTypes)
      // Uncomment to filter to only known types
      // .filter(type => validVehicleTypes.includes(type))
      .sort();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching vehicle types:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get categories and subcategories endpoint - updated to match frontend structure
app.get("/api/categories", async (req, res) => {
  try {
    // Define category groups matching frontend
    const categoryGroups = [
      {
        name: "Engines & Engine Parts",
        subcategories: ["Engines", "Engine Parts"],
      },
      {
        name: "Brake System",
        subcategories: [
          "Brake Pads",
          "Brake Discs",
          "Brake Calipers",
          "Brake Shoes",
          "Brake Boosters",
          "Brake Lines",
          "Brake Sensors",
          "Handbrake Cables",
          "Handbrake Levers",
        ],
      },
      {
        name: "Transmission",
        subcategories: ["Gearboxes", "Gear Cables", "Gear Shifters"],
      },
      {
        name: "Electrical",
        subcategories: [
          "Alternators",
          "ECUs",
          "Speedometers",
          "Door Window Motors",
          "Power Window Switches",
          "Wiring Harnesses",
          "Headlight Switches",
          "Ignition Coils",
          "Fuel Pumps",
          "Starter Motors",
          "Fuses",
          "Relays",
          "Fuse Boxes",
          "Ignition Switches",
          "Wiring Connectors",
          "Headlights",
          "Tail Lights",
          "Head , Tail & Turn Signal Light Switches",
          "Heater",
        ],
      },
      {
        name: "Suspension",
        subcategories: [
          "Shock Absorbers",
          "Front Shocks",
          "Rear Shocks",
          "Strut Bars",
        ],
      },
      {
        name: "Cooling System",
        subcategories: [
          "Radiators",
          "Water Pumps",
          "Radiator Fan Motors",
          "AC Condensers",
        ],
      },
      {
        name: "Exhaust",
        subcategories: [
          "Exhaust Pipes",
          "Mufflers",
          "Catalytic Converters",
          "Exhaust Manifolds",
        ],
      },
      {
        name: "Body Parts",
        subcategories: [
          "Bonnet",
          "Doors",
          "Fender",
          "Front buffer",
          "Rear buffer",
          "Side mirrors",
          "Dickey door",
          "Fuel body cap",
          "Mudlaps",
          "Inner guards",
          "Spoiler",
          "Side skirts",
          "Buffer Lips",
          "Dickey Garnish",
          "Windscreens",
          "Door Window Glass",
        ],
      },
      {
        name: "Locks",
        subcategories: [
          "Inner Door Locks",
          "Outer Door Locks",
          "Dickey Locks",
          "Bonnet Locks",
          "Steering Lock",
          "Ignition Lock",
          "Fuel Cap Lock",
          "Glove Box Lock",
          "Tool Box Lock",
        ],
      },
      {
        name: "Lights",
        subcategories: [
          "Head lights",
          "Parking lights",
          "Signal lights",
          "Fender signal lights",
          "Fog lights",
          "Tail lights",
        ],
      },
      {
        name: "Interior Parts",
        subcategories: [
          "Dashboard",
          "Door Boards",
          "Steering Wheels",
          "Steering Columns",
          "Airbags",
          "Seat Belts",
          "Headliners",
          "Sun Visors",
          "Rear View Mirrors",
          "Door Handles",
          "Plastic Parts",
        ],
      },
    ];

    // Get categories and subcategories from database
    const snapshot = await productsCollection
      .select("category", "subcategory")
      .get();
    const foundCategories = new Set();
    const foundSubcategories = new Map();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const category = data.category;
      const subcategory = data.subcategory;

      if (category) {
        foundCategories.add(category);

        // Track subcategories by their parent category
        if (subcategory) {
          if (!foundSubcategories.has(category)) {
            foundSubcategories.set(category, new Set());
          }
          foundSubcategories.get(category).add(subcategory);
        }
      }
    });

    // Combine predefined categories with found ones
    const result = categoryGroups.map((group) => {
      // Get found subcategories for this category if any
      const dbSubcategories = foundSubcategories.get(group.name);
      const allSubcategories = new Set([...group.subcategories]);

      // Add any subcategories found in DB that aren't in our predefined list
      if (dbSubcategories) {
        dbSubcategories.forEach((sub) => allSubcategories.add(sub));
      }

      return {
        name: group.name,
        subcategories: Array.from(allSubcategories).sort(),
      };
    });

    // Also add any categories found in DB that aren't in our predefined list
    const knownCategories = new Set(categoryGroups.map((g) => g.name));
    foundCategories.forEach((category) => {
      if (!knownCategories.has(category)) {
        const dbSubcategories = foundSubcategories.get(category) || new Set();
        result.push({
          name: category,
          subcategories: Array.from(dbSubcategories).sort(),
        });
      }
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get subcategories for a specific category
app.get("/api/categories/:categoryName/subcategories", async (req, res) => {
  try {
    const { categoryName } = req.params;

    // Find the matching category group
    const categoryGroups = [
      {
        name: "Engines & Engine Parts",
        subcategories: ["Engines", "Engine Parts"],
      },
      // ... (all category groups as defined above)
    ];

    const categoryGroup = categoryGroups.find(
      (group) => group.name === decodeURIComponent(categoryName)
    );

    if (!categoryGroup) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Get any additional subcategories from the database
    const snapshot = await productsCollection
      .where("category", "==", categoryName)
      .select("subcategory")
      .get();

    const dbSubcategories = new Set();
    snapshot.docs.forEach((doc) => {
      const subcategory = doc.data().subcategory;
      if (subcategory) {
        dbSubcategories.add(subcategory);
      }
    });

    // Combine predefined subcategories with ones from the database
    const allSubcategories = new Set([
      ...categoryGroup.subcategories,
      ...dbSubcategories,
    ]);

    res.status(200).json(Array.from(allSubcategories).sort());
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get brands endpoint
app.get("/api/brands", async (req, res) => {
  try {
    const snapshot = await productsCollection.select("brand").get();
    const brands = new Set();

    snapshot.docs.forEach((doc) => {
      const brand = doc.data().brand;
      if (brand) {
        brands.add(brand);
      }
    });

    res.status(200).json(Array.from(brands).sort());
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ message: error.message });
  }
});

// Bulk operations endpoints with improved error handling and verification
app.post("/api/products/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No valid IDs provided" });
    }

    // Get all products to delete first (to handle image cleanup)
    const batch = db.batch();
    const deletedImages = [];
    const failedImages = [];

    // Process products in chunks to respect Firestore batch limits
    const batchSize = 500; // Firestore batch limit is 500 operations

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const promises = chunk.map((id) => productsCollection.doc(id).get());
      const docs = await Promise.all(promises);

      const batchChunk = db.batch();

      docs.forEach((doc) => {
        if (doc.exists) {
          const data = doc.data();

          // Collect image URLs for later deletion
          if (data.images && Array.isArray(data.images)) {
            deletedImages.push(...data.images);
          }

          // Add delete operation to batch
          batchChunk.delete(doc.ref);
        }
      });

      await batchChunk.commit();
    }

    // Clean up images from Cloudinary
    if (deletedImages.length > 0) {
      try {
        const publicIds = deletedImages
          .map((url) => extractCloudinaryPublicId(url))
          .filter(Boolean);

        // Delete in chunks to avoid rate limits
        const cloudinaryBatchSize = 30;
        for (let i = 0; i < publicIds.length; i += cloudinaryBatchSize) {
          const chunk = publicIds.slice(i, i + cloudinaryBatchSize);
          const results = await Promise.allSettled(
            chunk.map(async (publicId) => {
              try {
                return await cloudinary.uploader.destroy(publicId);
              } catch (err) {
                console.error(
                  `Failed to delete Cloudinary image ${publicId}:`,
                  err
                );
                failedImages.push({ publicId, error: err.message });
                return null;
              }
            })
          );
        }
      } catch (deleteErr) {
        console.error("Error deleting Cloudinary images:", deleteErr);
      }
    }

    res.status(200).json({
      message: `Successfully deleted ${ids.length} products`,
      deletedCount: ids.length,
      imagesDeleted: deletedImages.length - failedImages.length,
      imagesFailed: failedImages.length > 0 ? failedImages : undefined,
    });
  } catch (error) {
    console.error("Error bulk deleting products:", error);
    res.status(500).json({ message: error.message });
  }
});

// Bulk update featured status
app.post("/api/products/bulk-update-featured", async (req, res) => {
  try {
    const { ids, featured } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No valid IDs provided" });
    }

    if (featured === undefined) {
      return res
        .status(400)
        .json({ message: "Featured status must be provided" });
    }

    // Process products in chunks to respect Firestore batch limits
    const batchSize = 500; // Firestore batch limit is 500 operations
    let updatedCount = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach((id) => {
        const docRef = productsCollection.doc(id);
        batch.update(docRef, {
          featured: Boolean(featured),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      updatedCount += chunk.length;
    }

    res.status(200).json({
      message: `Updated featured status for ${updatedCount} products`,
      updatedCount,
    });
  } catch (error) {
    console.error("Error updating featured status:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get stats endpoint
app.get("/api/stats", async (req, res) => {
  try {
    // Get total products
    const productsSnapshot = await productsCollection.count().get();
    const totalProducts = productsSnapshot.data().count;

    // Get featured products count
    const featuredSnapshot = await productsCollection
      .where("featured", "==", false)
      .count()
      .get();
    const featuredProducts = featuredSnapshot.data().count;

    // Get products by vehicle type
    const vehicleTypesSnapshot = await productsCollection
      .select("vehicleType")
      .get();
    const vehicleTypeCounts = {};

    vehicleTypesSnapshot.docs.forEach((doc) => {
      const vehicleType = doc.data().vehicleType;
      if (vehicleType) {
        if (Array.isArray(vehicleType)) {
          vehicleType.forEach((type) => {
            if (type) {
              vehicleTypeCounts[type] = (vehicleTypeCounts[type] || 0) + 1;
            }
          });
        } else {
          vehicleTypeCounts[vehicleType] =
            (vehicleTypeCounts[vehicleType] || 0) + 1;
        }
      }
    });

    // Get products by category
    const categoriesSnapshot = await productsCollection
      .select("category")
      .get();
    const categoryCounts = {};

    categoriesSnapshot.docs.forEach((doc) => {
      const category = doc.data().category;
      if (category) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    });

    res.status(200).json({
      totalProducts,
      featuredProducts,
      vehicleTypeCounts,
      categoryCounts,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: error.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
    serverInfo: {
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
    },
  });
});

// Add error handler middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
