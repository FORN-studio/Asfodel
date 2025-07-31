import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { waitUntil } from '@vercel/functions';
import { GameEngine } from '$lib/server/game/GameEngine';
import { error } from '@sveltejs/kit';
import { CRON_SECRET } from '$env/static/private';

export const GET: RequestHandler = async ({ request }) => {
  if (request.headers.get('authorization') !== CRON_SECRET) error(401, 'Unauthorized')
  waitUntil((async () => {
    const engine = new GameEngine();

    for (let i = 0; i < 6; i++) {
      try {
        await engine.processNextAgent();

        if (Math.random() < 0.03)  await engine.spawnEnergyPacket();
        if (Math.random() < 0.06)  await engine.ageAllTrees();
        if (Math.random() < 0.05)  await engine.cleanupExpiredEvents();
        if (Math.random() < 0.10)  await engine.cleanupStuckProcessingStates();
      } catch (err) {
        console.error('Background processing error:', err);
      }

      await new Promise((r) => setTimeout(r, 10_000));
    }
  })());

  return json({ scheduled: true });
};