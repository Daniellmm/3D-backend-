const express = require("express");
const { MongoClient } = require("mongodb");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { ObjectId } = require("mongodb"); 
require("dotenv").config({ path: "./Config.env" });

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/images', express.static('images'));




const directories = ["uploads", "images"];
directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "imageFile") {
      cb(null, "images/");
    } else if (file.fieldname === "modelFile") {
      cb(null, "uploads/");
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.glb', '.gltf'];
    if (allowedExtensions.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error("Only images (.jpg, .jpeg, .png) and 3D models (.glb, .gltf) are allowed."));
    }
  }
});

// MongoDB connection
const DB = process.env.ATLAS_URI;
const client = new MongoClient(DB);

async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
connectDB();

// Serve static files from respective directories
app.use('/uploads', express.static('uploads'));
app.use('/images', express.static('images'));


app.post("/upload-model", upload.fields([
  { name: "imageFile", maxCount: 1 },
  { name: "modelFile", maxCount: 1 }
]), async (req, res) => {
  const { title, description, beds, dimensions, location, price } = req.body;
 const imageFile = req.files.imageFile ? req.files.imageFile[0] : null;
  const modelFile = req.files.modelFile ? req.files.modelFile[0] : null;

  
  if (!title || !description || !beds || !dimensions || !location || !price || !imageFile || !modelFile) {
    return res.status(400).json({ error: "All fields, including image and model files, are required." });
  }

  try {
   
    const result = await client.db("3Dmodeldb").collection("upload-model").insertOne({
      title,
      description,
      beds,
      dimensions,
      location,
      price,
      imagePath: `/images/${imageFile.filename}`,
      modelPath: `/uploads/${modelFile.filename}`,
      imageOriginalName: imageFile.originalname,
      modelOriginalName: modelFile.originalname,
      uploadDate: new Date(),
    });

    res.status(200).json({
      message: "Image and model uploaded successfully",
      id: result.insertedId,
      imagePath: `/images/${imageFile.filename}`,
      modelPath: `/uploads/${modelFile.filename}`,
    });
  } catch (e) {
    console.error("Error saving metadata:", e);
    res.status(500).json({ error: "Error saving metadata" });
  }
});


app.get("/models", async (req, res) => {
  try {
    const models = await client.db("3Dmodeldb").collection("upload-model").find({}).toArray();
    res.json(models);
  } catch (e) {
    console.error("Error fetching models:", e);
    res.status(500).json({ error: "Error fetching models" });
  }
});

app.get("/models/:id", async (req, res) => {
  try {
    const modelId = req.params.id;
    const model = await client
      .db("3Dmodeldb")
      .collection("upload-model")
      .findOne({ _id: new ObjectId(modelId) }); 

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    res.json(model);
  } catch (e) {
    console.error("Error fetching model:", e);
    res.status(500).json({ error: "Error fetching model" });
  }
});



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Something went wrong!" });
});

// Start the server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
