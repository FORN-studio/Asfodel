import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import type { EventProcessor } from "../events/EventQueue";
import type { FunctionDeclaration } from "@google/genai";

export class PluginManager {
  private plugins: Map<string, GamePlugin> = new Map();
  private functionToPlugin: Map<string, GamePlugin> = new Map();
  private eventProcessors: Map<string, EventProcessor> = new Map();

  registerPlugin(plugin: GamePlugin): void {
    this.plugins.set(plugin.name, plugin);
    
    const functionDeclarations = plugin.getFunctionDeclarations();
    for (const func of functionDeclarations) {
      if (func.name) {
        this.functionToPlugin.set(func.name, plugin);
      }
    }
    
    const eventProcessors = plugin.getEventProcessors?.() || {};
    for (const [eventName, processor] of Object.entries(eventProcessors)) {
      this.eventProcessors.set(eventName, processor);
    }
  }

  getAllFunctionDeclarations(): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];
    for (const plugin of this.plugins.values()) {
      declarations.push(...plugin.getFunctionDeclarations());
    }
    return declarations;
  }

  getAllowedFunctionNames(): string[] {
    return Array.from(this.functionToPlugin.keys());
  }

  async handleFunctionCall(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    const plugin = this.functionToPlugin.get(functionName);
    if (!plugin) {
      throw new Error(`No plugin found for function: ${functionName}`);
    }

    if (!plugin.canHandleFunction(functionName)) {
      throw new Error(`Plugin ${plugin.name} cannot handle function: ${functionName}`);
    }

    return await plugin.handleFunction(functionName, args, agentId, db);
  }

  async gatherPromptContributions(context: PromptContext, db: DatabaseService): Promise<string[]> {
    const contributions: string[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (plugin.gatherContextData) {
        const pluginData = await plugin.gatherContextData(context.agent.id, db);
        Object.assign(context, pluginData);
      }
    }
    
    for (const plugin of this.plugins.values()) {
      if (plugin.contributeToPrompt) {
        const contribution = plugin.contributeToPrompt(context);
        if (contribution.trim()) {
          contributions.push(contribution);
        }
      }
    }
    
    return contributions;
  }

  getEventProcessor(eventName: string): EventProcessor | undefined {
    return this.eventProcessors.get(eventName);
  }

  getAllEventProcessors(): Map<string, EventProcessor> {
    return new Map(this.eventProcessors);
  }

  getPlugins(): GamePlugin[] {
    return Array.from(this.plugins.values());
  }
}