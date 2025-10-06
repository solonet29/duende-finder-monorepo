import dbConnect from '../../lib/dbConnect';
import CmsTask from '../../models/CmsTask';

export default async function handler(req, res) {
  const { id } = req.query;
  const { method } = req;

  await dbConnect();

  switch (method) {
    case 'DELETE':
      try {
        const deletedTask = await CmsTask.findByIdAndDelete(id);
        if (!deletedTask) {
          return res.status(404).json({ success: false, error: 'Task not found' });
        }
        res.status(200).json({ success: true, data: {} });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
      break;

    // Future methods like GET (for one task) or PUT can be added here.
    default:
      res.setHeader('Allow', ['DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
      break;
  }
}
