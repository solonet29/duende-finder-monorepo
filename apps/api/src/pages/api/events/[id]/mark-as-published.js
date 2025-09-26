
import { getEventModel } from '../../../lib/database';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { id } = req.query;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid event ID' });
  }

  try {
    const Event = await getEventModel();
    const result = await Event.updateOne(
      { _id: new ObjectId(id) },
      { $set: { 'social.publishedAt': new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.status(200).json({ success: true, message: 'Event marked as published' });
  } catch (error) {
    console.error('Error marking event as published:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
