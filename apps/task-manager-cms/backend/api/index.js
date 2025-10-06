const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Task = require('../models/Task');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // To parse JSON bodies

// --- Database Connection ---
// IMPORTANT: Add your MongoDB connection string to your environment variables as MONGODB_URI.
const dbURI = process.env.MONGODB_URI;

const connectDB = async () => {
  // Check if we have a connection to the database or if it's currently
  // connecting or disconnecting (readyState holds the connection status).
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  
  if (!dbURI) {
    throw new Error('MongoDB URI not found in environment variables.');
  }

  return mongoose.connect(dbURI);
};

// --- API Routes ---

// Middleware to connect to DB before each request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ message: 'Database connection failed' });
  }
});


// GET /api/tasks - Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
});

// POST /api/tasks - Create a new task
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, status } = req.body;
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    const newTask = new Task({ title, description, status });
    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (error) {
    res.status(400).json({ message: 'Error creating task', error: error.message });
  }
});

// PUT /api/tasks/:id - Update a task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status } = req.body;

    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { title, description, status },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: 'Error updating task', error: error.message });
  }
});

// DELETE /api/tasks/:id - Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTask = await Task.findByIdAndDelete(id);

    if (!deletedTask) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});


// Export the app for Vercel
module.exports = app;