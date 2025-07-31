import type { GamePlugin, ActionResult, PromptContext } from "./GamePlugin";
import type { DatabaseService } from "../data/DatabaseService";
import { Type, type FunctionDeclaration } from "@google/genai";

export class MemoryPlugin implements GamePlugin {
  name = "memory";

  getFunctionDeclarations(): FunctionDeclaration[] {
    return [{
      name: 'save_memory',
      description: 'Save a memory to your memory bank. Use this to track anything that might help you survive in the future.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          new_memory: {
            type: Type.STRING,
            description: 'The memory string to save.',
          },
        },
        required: ['new_memory'],
      },
    }];
  }

  canHandleFunction(functionName: string): boolean {
    return functionName === 'save_memory';
  }

  async handleFunction(
    functionName: string,
    args: Record<string, unknown>,
    agentId: number,
    db: DatabaseService
  ): Promise<ActionResult> {
    if (functionName !== 'save_memory') {
      throw new Error(`MemoryPlugin cannot handle function: ${functionName}`);
    }

    const newMemory = args.new_memory as string;
    return await this.saveMemory(agentId, newMemory, db);
  }

  contributeToPrompt(context: PromptContext): string {
    const memoriesSection = !context.memories.length
      ? 'You currently have no memories.'
      : `You currently have ${context.memories.length} memories: \n${context.memories.join('\n')}`;

    return memoriesSection;
  }

  async gatherContextData(agentId: number, db: DatabaseService): Promise<Record<string, any>> {
    const memories = await db.getMemories(agentId);
    return { memories };
  }

  private async saveMemory(agentId: number, newMemory: string, db: DatabaseService): Promise<ActionResult> {
    const agent = await db.createMemory(agentId, newMemory);
    return {
      success: true,
      log: `${agent.name} saved a new memory: "${newMemory}"`
    };
  }
}