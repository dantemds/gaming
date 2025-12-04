import { NextApiRequest, NextApiResponse } from 'next';
import { gameState } from '@/lib/gameState';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { playerId, playerName, playerColor } = req.body;

  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Missing playerId or playerName' });
  }

  const result = gameState.joinQueue(playerId, playerName, playerColor || '#FF6347');
  res.status(200).json(result);
}
