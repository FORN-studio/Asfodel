import type { GenerateContentResponse } from "@google/genai";
import type { Tables } from "$lib/database.types";
import { DatabaseService } from "../data/DatabaseService";
import { getPluginManager } from "../plugins/PluginRegistry";

interface ActionResult {
  success: boolean;
  log: string;
  pendingConfirmation?: boolean;
}

interface PendingBoobyTrap {
  agentId: number;
  packetId: string;
  timestamp: number;
}

class PendingActionManager {
  private static pendingBoobyTraps: Map<number, PendingBoobyTrap> = new Map();

  static setPendingBoobyTrap(agentId: number, packetId: string): void {
    this.pendingBoobyTraps.set(agentId, {
      agentId,
      packetId,
      timestamp: Date.now()
    });
  }

  static getPendingBoobyTrap(agentId: number): PendingBoobyTrap | null {
    return this.pendingBoobyTraps.get(agentId) || null;
  }

  static clearPendingBoobyTrap(agentId: number): void {
    this.pendingBoobyTraps.delete(agentId);
  }

  static hasPendingBoobyTrap(agentId: number): boolean {
    return this.pendingBoobyTraps.has(agentId);
  }
}

export { PendingActionManager };


const reqString = (o: Record<string, unknown>, k: string): string => {
  const v = o[k];
  if (typeof v !== 'string') throw new Error(`Expected string '${k}'`);
  return v;
};

const reqNumber = (o: Record<string, unknown>, k: string): number => {
  const v = o[k];
  if (typeof v !== 'number') throw new Error(`Expected number '${k}'`);
  return v;
};

export async function handleFunctionCalls(
  response: GenerateContentResponse,
  agentId: number
): Promise<Array<{ name: string; result: ActionResult }>> {
  const results: Array<{ name: string; result: ActionResult }> = [];
  if (!response.functionCalls?.length) return results;

  const pluginManager = getPluginManager();
  const db = new DatabaseService();

  for (const call of response.functionCalls ?? []) {
    const args = call.args as Record<string, unknown> | undefined;
    if (!args) continue;

    try {
      const result = await pluginManager.handleFunctionCall(call.name!, args, agentId, db);
      results.push({ name: call.name!, result });
    } catch (error) {
      throw new Error(`Error handling function ${call.name}: ${error}`);
    }
  }

  return results;
}