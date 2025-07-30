import { GameEngine } from "$lib/server/game/GameEngine";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const gameEngine = new GameEngine();

export const POST: RequestHandler = async () => {
    const result = await gameEngine.resetWorld();
    return json(result);
} 