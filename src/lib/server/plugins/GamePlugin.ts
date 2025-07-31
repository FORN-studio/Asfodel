import type { GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import type { Tables } from "$lib/database.types";
import type { DatabaseService } from "../data/DatabaseService";
import type { EventEffect, EventProcessor } from "../events/EventQueue";

export interface ActionResult {
  success: boolean;
  log: string;
  pendingConfirmation?: boolean;
}

export interface PromptContext {
  agent: Tables<'agents'>;
  messages: any[];
  nearbyEvents: any[];
  ownActions: any[];
  allAgents: Pick<Tables<'agents'>, 'id' | 'name' | 'energy' | 'gold' | 'x_position' | 'y_position'>[];
  packets: Tables<'energy_packets'>[];
  memories: string[];
  plans: Array<{ id: number; plan: string; created_at: string }>;
  trees: (Tables<'trees'> & { planted_by: { name: string } | null })[];
  eggs: (Tables<'eggs'> & { laid_by: { id: number, name: string, x_position: number, y_position: number } | null, nurtured_by: { name: string } | null })[];
  trustRelationships: Array<{ other_agent_name: string; trustworthiness: number }>;
  goldChests: Tables<'gold_chests'>[];
}

export interface GamePlugin {
  name: string;
  
  getFunctionDeclarations(): FunctionDeclaration[];
  
  canHandleFunction(functionName: string): boolean;
  
  handleFunction(
    functionName: string, 
    args: Record<string, unknown>, 
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult>;
  
  contributeToPrompt?(context: PromptContext): string;
  
  getEventProcessors?(): Record<string, EventProcessor>;
  
  gatherContextData?(agentId: number, db: DatabaseService): Promise<Record<string, any>>;
}