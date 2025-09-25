import { getEventModel } from '@/lib/database.js';
import { runMiddleware, corsMiddleware } from '@/lib/cors.js';

export default async function handler(req, res) {
    await runMiddleware(req, res, corsMiddleware);

    try {
        const Event = await getEventModel();

        // Fetch the 10 most recently created events
        const recentEvents = await Event.find({}).sort({ createdAt: -1 }).limit(10).lean();

        res.status(200).json(recentEvents);

    } catch (err) {
        console.error("Error in /api/debug-events:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
}
