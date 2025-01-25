const express = require("express");
const multer = require("multer");
const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./Config.env" });
const cors = require("cors");
const path = require("path");

const app = express();


app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());


app.use('/uploads', express.static('uploads'));


const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {

    if (file.mimetype === 'model/gltf-binary' || file.mimetype === 'model/gltf+json' ||
      path.extname(file.originalname).toLowerCase() === '.glb' ||
      path.extname(file.originalname).toLowerCase() === '.gltf') {
      cb(null, true);
    } else {
      cb(new Error('Only .glb and .gltf files are allowed!'));
    }
  }
});


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


app.post("/upload-model", upload.single("model"), async (req, res) => {
  const file = req.file;

  const { title, description, beds, dimensions, location, price } = req.body;

  if (!file || !title || !description || !beds || !dimensions || !location || !price) {
    return res.status(400).json({ error: "All fields are required." });
  }



  try {
    const result = await client.db("3Dmodeldb").collection("upload-model").insertOne({
      title,
      description,
      filename: file.filename,
      dimensions,
      location,
      price,
      beds,
      path: `uploads/${file.filename}`,
      originalname: file.originalname,
      uploadDate: new Date(),
    });

    res.status(200).json({
      message: "3D model uploaded successfully",
      id: result.insertedId
    });
  } catch (e) {
    console.error("Error uploading the model:", e);
    res.status(500).json({ error: "Error uploading the model" });
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


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});