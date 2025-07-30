import { GameEngine } from "$lib/server/game/GameEngine";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const gameEngine = new GameEngine();

export const POST: RequestHandler = async () => {
    try {
        await gameEngine.forceCleanupAllProcessingStates();
        return json({ success: true, message: "All processing states cleaned up" });
    } catch (error) {
        console.error('Cleanup error:', error);
        return json({ 
            success: false, 
            error: 'Cleanup failed' 
        }, { status: 500 });
    }
}