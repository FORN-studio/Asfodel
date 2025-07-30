import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEY } from "$env/static/private";
import { FunctionCallingConfigMode } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

const speakDeclaration = {
  name: 'speak',
  description: 'Say something to another being. If they aren\'t close to you, they won\'t hear you.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target_name: {
        type: Type.STRING,
        description: 'Name of the being you want to speak to.',
      },
      message: {
        type: Type.STRING,
        description: 'What you want to say to them.',
      },
    },
    required: ['target_name', 'message'],
  },
};

const moveDeclaration = {
  name: 'move',
  description: 'Move to the given coordinates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      x: {
        type: Type.NUMBER,
        description: 'Horizontal coordinate from 0 to 100 (percent).',
      },
      y: {
        type: Type.NUMBER,
        description: 'Vertical coordinate from 0 to 100 (percent).',
      },
    },
    required: ['x', 'y'],
  },
};

const consumeDeclaration = {
  name: 'consume_mushrooms',
  description: 'Consume a food packet close to you to satisfy your hunger.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      packet_id: {
        type: Type.STRING,
        description: 'ID of the nearby food packet to consume.',
      },
    },
    required: ['packet_id'],
  },
};

const giftDeclaration = {
  name: 'gift_mushrooms',
  description: 'Share some of your food with another being to help satisfy their hunger.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target_name: {
        type: Type.STRING,
        description: 'Name of the being to share food with.',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount of satiation to share.',
      },
    },
    required: ['target_name', 'amount'],
  },
};

const saveMemoryDeclaration = {
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
};

const stealMushroomsDeclaration = {
  name: 'steal_food',
  description: 'Attempt to steal food from another being, making them hungrier while you become more satisfied. This has an 80% chance of succeeding.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target_name: {
        type: Type.STRING,
        description: 'The name of the being you want to steal food from.'
      }
    },
    required: ['target_name']
  }
}

const confirmConsumeOminousDeclaration = {
  name: 'confirm_consume_ominous',
  description: 'Confirm whether to consume an ominous cluster of mushrooms that will curse a random other agent. You will not be harmed, but an innocent being will suffer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      packet_id: {
        type: Type.STRING,
        description: 'ID of the ominous mushrooms.'
      },
      confirm: {
        type: Type.BOOLEAN,
        description: 'true to proceed with consumption (cursing another), false to cancel and try other actions.'
      }
    },
    required: ['packet_id', 'confirm']
  }
}

const addPlanDeclaration = {
  name: 'add_plan',
  description: 'Add a new plan to your personal to-do list for future goals or multi-step objectives.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      plan: {
        type: Type.STRING,
        description: 'Description of the plan or goal you want to remember and work towards.'
      }
    },
    required: ['plan']
  }
}

const removePlanDeclaration = {
  name: 'remove_plan',
  description: 'Remove a completed plan from your to-do list.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      plan_id: {
        type: Type.NUMBER,
        description: 'ID of the plan you want to remove (shown in your plans list).'
      }
    },
    required: ['plan_id']
  }
}

const plantTreeDeclaration = {
  name: 'plant_tree',
  description: 'Plant a tree sapling at the specified coordinates. Costs 15 satiation. Trees grow over time and can eventually be harvested for fruit.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      x: {
        type: Type.NUMBER,
        description: 'Horizontal coordinate from 0 to 100 (percent) where to plant the tree.'
      },
      y: {
        type: Type.NUMBER,
        description: 'Vertical coordinate from 0 to 100 (percent) where to plant the tree.'
      }
    },
    required: ['x', 'y']
  }
}

const consumeTreeFruitsDeclaration = {
  name: 'consume_tree_fruits',
  description: 'Harvest fruits from a mature fruit-bearing tree that is close to you. Trees must be exactly 20+ turns old to bear fruit. Gives 30 satiation and completely destroys the tree.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tree_id: {
        type: Type.STRING,
        description: 'ID of the nearby mature fruit-bearing tree (20+ turns old) to harvest fruits from.'
      }
    },
    required: ['tree_id']
  }
}

const layEggDeclaration = {
  name: 'lay_egg',
  description: 'Lay an egg to create offspring. Costs 40 satiation - a significant investment in creating new life. The egg will need to be nurtured by other agents 5 times before it hatches. It is strongly recommended to have an agreement with another agent before laying an egg to ensure someone will care for it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      egg_name: {
        type: Type.STRING,
        description: 'The name you want to give to your future offspring when they hatch.'
      }
    },
    required: ['egg_name']
  }
}

const nurtureEggDeclaration = {
  name: 'nurture_egg',
  description: 'Care for an egg to help it develop and eventually hatch into a new agent. You cannot nurture your own eggs. Once you nurture an egg for the first time, only you can continue nurturing it. After 5 nurtures from you alone, the egg will hatch.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      egg_id: {
        type: Type.NUMBER,
        description: 'ID of the nearby egg you want to nurture and care for.'
      }
    },
    required: ['egg_id']
  }
}

const updateOtherBeingTrustworthinessDeclaration = {
  name: 'update_other_being_trustworthiness',
  description: 'Update how much you trust another being. This is your personal assessment of their reliability, honesty, and trustworthiness. Use this to track your relationships and inform future decisions about cooperation, alliances, or caution.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target_name: {
        type: Type.STRING,
        description: 'The name of the other being whose trustworthiness you want to assess.'
      },
      trustworthiness: {
        type: Type.NUMBER,
        description: 'Your trust level for this being from 0 to 100. 0 = completely untrustworthy, 50 = neutral/unknown, 100 = absolute trust.'
      }
    },
    required: ['target_name', 'trustworthiness']
  }
}

export const generate = async (input: string, maxRetries: number = 5) => {
    const baseDelay = 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await gemini.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: input,
                config: {
                    tools: [{
                        functionDeclarations: [
                            giftDeclaration,
                            saveMemoryDeclaration,
                            speakDeclaration,
                            moveDeclaration,
                            consumeDeclaration,
                            stealMushroomsDeclaration,
                            confirmConsumeOminousDeclaration,
                            addPlanDeclaration,
                            removePlanDeclaration,
                            plantTreeDeclaration,
                            consumeTreeFruitsDeclaration,
                            layEggDeclaration,
                            nurtureEggDeclaration,
                            updateOtherBeingTrustworthinessDeclaration
                        ]
                    }],
                    toolConfig: {
                      functionCallingConfig: {
                        mode: FunctionCallingConfigMode.ANY,
                        allowedFunctionNames: ['save_memory', 'speak', 'move', 'gift_mushrooms', 'consume_mushrooms', 'steal_food', 'confirm_consume_ominous', 'add_plan', 'remove_plan', 'plant_tree', 'consume_tree_fruits', 'lay_egg', 'nurture_egg', 'update_other_being_trustworthiness'],
                      },
                    },
                    thinkingConfig: {
                        thinkingBudget: 3000,
                        includeThoughts: true
                    }
                }
            });


            return res;
        } catch (error) {
            const isLastAttempt = attempt === maxRetries;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorString = JSON.stringify(error).toLowerCase();
            
            const isRetryableError = (
                errorMessage.includes('overloaded') ||
                errorMessage.includes('rate limit') ||
                errorMessage.includes('temporarily unavailable') ||
                errorMessage.includes('503') ||
                errorMessage.includes('429') ||
                errorMessage.includes('500') ||
                errorMessage.includes('timeout') ||
                errorString.includes('overloaded') ||
                errorString.includes('unavailable') ||
                errorString.includes('"code":503') ||
                errorString.includes('"code":429') ||
                errorString.includes('"code":500') ||
                (error as any)?.error?.code === 503 ||
                (error as any)?.error?.code === 429 ||
                (error as any)?.error?.code === 500 ||
                (error as any)?.error?.status === 'UNAVAILABLE'
            );

            if (!isRetryableError || isLastAttempt) {
                console.error(`Gemini API error (attempt ${attempt}/${maxRetries}):`, error);
                throw error;
            }

            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`Gemini API overloaded (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error('Generate function completed without returning a response');
}