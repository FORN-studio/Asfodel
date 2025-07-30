import { GameEngine } from "$lib/server/game/GameEngine";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { CRON_SECRET } from "$env/static/private";

const gameEngine = new GameEngine();

export const POST: RequestHandler = async ({ request }) => {
    if (request.headers.get('authorization') !== CRON_SECRET) error(401, 'Unauthorized')
    
    const result = await gameEngine.seedWorld();
    return json(result);
} 