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
    try {
      const match = gameState.getMatchState(matchId, playerId);
      
      if (!match) {
        // Retornar erro 404 mas sem quebrar o polling
        return res.status(404).json({ 
          error: 'Match not found',
          message: 'Match may have expired or been cleaned up'
        });
      }

      // Retornar o estado do match
      res.status(200).json(match);
    } catch (error) {
      console.error('Error getting match state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
