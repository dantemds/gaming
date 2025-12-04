import { NextApiRequest, NextApiResponse } from 'next';
import { gameState } from '@/lib/gameState';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { matchId } = req.query;
  const { playerId } = req.body || req.query;

  if (!matchId || typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid matchId' });
  }

  if (!playerId || typeof playerId !== 'string') {
    return res.status(400).json({ error: 'Missing playerId' });
  }

  if (req.method === 'GET' || req.method === 'POST') {
    // Long polling: aguardar por mudanças
    const match = gameState.getMatchState(matchId, playerId);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.status(200).json(match);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
