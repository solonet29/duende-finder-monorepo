import dbConnect from '../../../lib/dbConnect';
import CmsTask from '../../../models/CmsTask';
import { exec } from 'child_process';
import util from 'util';

// Promisify exec to use it with async/await
const execPromise = util.promisify(exec);

export default async function handler(req, res) {
  const { id } = req.query;
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const task = await CmsTask.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Set status to running
    task.status = 'running';
    await task.save();

    try {
      // Execute the command. Note: This runs commands from the project root.
      const { stdout, stderr } = await execPromise(task.command, { cwd: process.env.VERCEL ? '/vercel/workspace' : process.cwd() });
      
      task.status = 'success';
      task.lastRunOutput = stdout || 'Completed successfully';
      
    } catch (executionError) {
      task.status = 'error';
      task.lastRunOutput = executionError.stderr || executionError.stdout || executionError.message;
    }
    
    await task.save();

    res.status(200).json({ success: true, data: task });

  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
