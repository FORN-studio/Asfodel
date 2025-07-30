import { GameEngine } from "$lib/server/game/GameEngine";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const gameEngine = new GameEngine();

function randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const POST: RequestHandler = async () => {
    try {
        const result = await gameEngine.processNextAgent();

        const shouldSpawnEnergy = randomInRange(0, 100) <= 3;
        if (shouldSpawnEnergy) {
            await gameEngine.spawnEnergyPacket();
        }

        const shouldAgeTrees = randomInRange(0, 100) <= 10;
        if (shouldAgeTrees) {
            await gameEngine.ageAllTrees();
        }

        if (randomInRange(0, 100) <= 5) {
            await gameEngine.cleanupExpiredEvents();
        }

        if (randomInRange(0, 100) <= 10) {
            await gameEngine.cleanupStuckProcessingStates();
        }

        return json(result);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('No agents available') || 
                error.message.includes('All agents are currently being processed')) {
                return json({ 
                    success: false, 
                    error: 'No agents available for processing at this time',
                    retry: true 
                });
            }
        }
        
        console.error('Processing error:', error);
        return json({ 
            success: false, 
            error: 'Processing failed',
            retry: false 
        }, { status: 500 });
    }
} 