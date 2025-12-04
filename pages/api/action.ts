import { NextApiRequest, NextApiResponse } from 'next';
import { gameState } from '@/lib/gameState';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchId, playerId, action } = req.body;

  if (!matchId || !playerId || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (action !== 'attack' && action !== 'defend' && action !== 'special') {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const match = gameState.performAction(matchId, playerId, action);

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  res.status(200).json(match);
}
