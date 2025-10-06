const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt timestamps
});

// Avoid recompiling the model if it already exists
module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
