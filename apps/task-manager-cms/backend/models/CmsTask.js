import mongoose from 'mongoose';

const CmsTaskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for the task.'],
    trim: true,
  },
  description: {
    type: String,
    required: false,
  },
  command: {
    type: String,
    required: [true, 'Please provide a command to execute.'],
  },
  status: {
    type: String,
    enum: ['idle', 'running', 'success', 'error'],
    default: 'idle',
  },
  lastRunOutput: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// In a serverless environment, we need to prevent Mongoose from recompiling the model.
export default mongoose.models.CmsTask || mongoose.model('CmsTask', CmsTaskSchema);
