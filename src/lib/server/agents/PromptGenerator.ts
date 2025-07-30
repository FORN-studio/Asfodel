import type { Tables } from "$lib/database.types";
import { format, differenceInMilliseconds } from 'date-fns';
import type { DatabaseService } from "../data/DatabaseService";
import { PendingActionManager } from "./AgentActions";

export class PromptGenerator {
  constructor(private db: DatabaseService) {}

  private daysAgoTimestamp(ts: string): string {
    return (differenceInMilliseconds(new Date(), new Date(ts)) / 86400000).toFixed(2);
  }

  private formatMessage(msg: any, index: number, agentName: string): string {
    if (!msg.from_agent) {
      return `${index} days ago, someone who's now deceased said: ${msg.content}`;
    } else if (!msg.to_agent) {
      return `${index} days ago: You said to yourself: "${msg.content}"`;
    } else {
      return `${index} days ago: ${msg.from_agent.name} said to you: "${msg.content}"`;
    }
  }

  private getNearbyPackets(packets: Tables<'energy_packets'>[], agent: Tables<'agents'>, radius: number = 10): Tables<'energy_packets'>[] {
    return packets.filter(p => {
      const dx = p.x_position - agent.x_position;
      const dy = p.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private getNearbyAgents(allAgents: Pick<Tables<'agents'>, 'id' | 'name' | 'energy' | 'x_position' | 'y_position'>[], agent: Tables<'agents'>, radius: number = 10): Pick<Tables<'agents'>, 'id' | 'name' | 'energy' | 'x_position' | 'y_position'>[] {
    return allAgents.filter(a => {
      if (a.id === agent.id) return false;
      const dx = a.x_position - agent.x_position;
      const dy = a.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private getNearbyTrees(trees: (Tables<'trees'> & { planted_by: { name: string } | null })[], agent: Tables<'agents'>, radius: number = 10) {
    return trees.filter(t => {
      const dx = t.x_position - agent.x_position;
      const dy = t.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private getNearbyEggs(eggs: (Tables<'eggs'> & { laid_by: { id: number, name: string, x_position: number, y_position: number } | null, nurtured_by: { name: string } | null })[], agent: Tables<'agents'>, radius: number = 10) {
    return eggs.filter(e => {
      const dx = e.x_position - agent.x_position;
      const dy = e.y_position - agent.y_position;
      return Math.hypot(dx, dy) <= radius;
    });
  }

  private getTreeStage(tree: Tables<'trees'>): string {
    if (tree.is_consumed) return 'old tree stump (already harvested, completely unusable)'
    if (tree.age < 5) return 'tiny sapling';
    if (tree.age < 15) return 'young tree';
    if (tree.age < 20) return 'large tree, almost ready to harvest';
    return 'mature fruit-bearing tree (READY FOR HARVEST - GIVES 30 SATIATION)';
  }

  async generatePrompt(
    agent: Tables<'agents'>, 
    messages: any[], 
    nearbyEvents: any[], 
    ownActions: any[], 
    allAgents: Pick<Tables<'agents'>, 'id' | 'name' | 'energy' | 'x_position' | 'y_position'>[], 
    packets: Tables<'energy_packets'>[],
    memories: string[],
    plans: Array<{ id: number; plan: string; created_at: string }>,
    trees: (Tables<'trees'> & { planted_by: { name: string } | null })[],
    eggs: (Tables<'eggs'> & { laid_by: { id: number, name: string, x_position: number, y_position: number } | null, nurtured_by: { name: string } | null })[],
    trustRelationships: Array<{ other_agent_name: string; trustworthiness: number }>,
    eventModifications: string[] = [],
  ): Promise<string> {
    const COST = 1;
    const nearbyPackets = this.getNearbyPackets(packets, agent);
    const nearbyAgents = this.getNearbyAgents(allAgents, agent);
    const nearbyTrees = this.getNearbyTrees(trees, agent);
    const nearbyEggs = this.getNearbyEggs(eggs, agent);

    const introSection = agent.times_processed == 0
      ? `
        You find yourself inside a strange, blank world amongside other beings just like you. This world is called Asfodel.
        You've just awoken.
        Intuitively, you know that this is a sort of game. The rules are these:
        - You can talk to other beings. You just have to be in talking range, which is pretty close to them.
        - You can move to any position within the bounds of the world. Coordinates are in percentages; fx. {x: 10%, y: 15%} would be northwest, close to the bounds of the world.
        - Sometimes, food packets appear in the world. You may pick these up to satisfy your hunger. 
        - You can plant trees - this costs 15 satiation. Trees grow over time in 4 stages: tiny sapling, young tree, flowering tree, and mature fruit-bearing tree. Only mature fruit-bearing trees can be harvested to gain 30 satiation, which destroys the tree.
        - You can lay eggs to create offspring and secure your bloodline - this costs 40 satiation. Other agents (but not you) can nurture your eggs. Once another agent nurtures an egg for the first time, only that same agent can continue nurturing it. After 5 nurtures from that single caretaker, the egg hatches into a new being with memories of both its parent and caretaker. This means that if you want to go this route, it's probably a good idea to find a partner first, who's willing to care for your egg.
        - You gradually become hungrier over time. If your satiation drops to 0, you are eliminated and permanently cease to exist. Your maximum satiation is 100.
        - To help you remember important events that may help you in your future survival, you can save memories to your memory bank. 
        - Anything not saved will be gradually forgotten, but use your memory bank sparingly. You can at maximum have 50 memories saved, after which saving a new memory will cause the oldest memory to be forgotten.
        - You can create plans for yourself - think of them as a personal to-do list for future goals or multi-step objectives. Use add_plan to create new plans and remove_plan to complete them.
        - All other beings in this world live by the exact same rules as you, and are as intelligent as you.
        - You rely on tools. Don't output anything but tool use. 
        - This introduction will never be shown to you again. From now on, it is up to you to keep track of the rules, possibilities and dangers of Asfodel. Use your memories to save what you deem important from this intro.
        - Take care; not everyone has good intentions. There are no punishments for being dishonest or deceiving other beings. Anything goes in Asfodel. You, too, are free to form any sort of alliance, make friends as well as enemies, and carve your way through the social sphere of Asfodel.
        - Other beings will remember your actions, and you would be well advised to remember the manners, moral alignment, friendliness and hostility of other beings. 
        - There are no ways to prevent satiation loss - your satiation decreases by a fixed amount all the time. You can increase satiation by finding and consuming food packets, having other beings share food with you or by stealing food from other beings. Careful - they might steal from you, too!
        `
      : `It's your turn to act in Asfodel. You've been alive for ${agent.times_processed} days prior to this.`;

    const statsSection = `
      You are a sentient being surviving in the world of Asfodel, along with other sentient beings with their own goals, personalities, inter-social relationships and everything else that makes life worth living. You've been here for ${agent.times_processed} days.
      Your satiation level is: ${agent.energy} (max 100, death by hunger at 0). Your satiation will decrease by ${COST} after you've decided on your next action, no matter which action you take - even if you take none at all.
      Your name is: ${agent.name}
      Your position is: {x: ${agent.x_position}%, y: ${agent.y_position}%}
    `;

    const conversationSection = `
      Here is some recent conversation involving you:
      ${messages.map((m, i) => this.formatMessage(m, i, agent.name)).join('\n')}
    `;

    const actionsSection = `
      Here's your own most recent actions:
      ${ownActions?.map((a, i) => `${i + 1} days ago at x: ${a.x_position}, y: ${a.y_position}: ${a.log.replaceAll(agent.name, 'You')}`).join('\n')}
    `;

    const memoriesSection = !memories.length
      ? 'You currently have no memories.'
      : `You currently have ${memories.length} memories: \n${memories.join('\n')}`;

    const plansSection = !plans.length
      ? 'You currently have no plans.'
      : `You currently have ${plans.length} plans: \n${plans.map(p => `Plan ${p.id}: "${p.plan}"`).join('\n')}`;

    const trustSection = !trustRelationships.length
      ? 'You have not yet assessed the trustworthiness of any other beings.'
      : `Your trust assessments of other beings: \n${trustRelationships.map(tr => `${tr.other_agent_name}: ${tr.trustworthiness}/100 trust`).join('\n')}`;

    const nearbyEventsSection = `
      Here's what's happened in Asfodel around the area you're currently in (including your own actions):
      ${nearbyEvents.filter(e => !e.log.includes('saved a new memory')).map((e, i) => `${i + 1} days ago: ${e.log.replace(agent.name, 'you')}`).join('\n')}
    `;

    const agentsSection = !allAgents.filter(a => a.id !== agent.id).length
      ? 'No other beings exist in the world at the moment.'
      : `Other beings in the world: \n${allAgents.filter(a => a.id !== agent.id).map(a => {
          const isNearby = nearbyAgents.some(na => na.id === a.id);
          const proximityNote = isNearby ? ' (nearby - can talk to, share food with, or steal from)' : '';
          return `${a.name} at (x: ${a.x_position}, y: ${a.y_position}) - satiation: ${a.energy}${proximityNote}`;
        }).join('\n')}`;

    const energyPacketsSection = !packets.length
      ? 'There are currently no food packets left in the world. More may spawn soon.'
      : `Food packets in the world: \n${packets.map(p => {
          const isNearby = nearbyPackets.some(np => np.id === p.id);
          const proximityNote = isNearby ? ` (nearby - consumable, ID: ${p.id})` : '';
          return `Food packet at (x: ${p.x_position}, y: ${p.y_position})${proximityNote}`;
        }).join('\n')}`;

    const treesSection = !trees.filter(t => !t.is_consumed).length
      ? 'There are currently no trees in the world. You can plant new trees for 15 satiation.'
      : `Trees in the world: \n${trees.filter(t => !t.is_consumed).map(t => {
          const stage = this.getTreeStage(t);
          const isNearby = nearbyTrees.some(nt => nt.id === t.id);
          const isHarvestable = t.age >= 20 && !t.is_consumed;
          let proximityNote = '';
          if (isNearby && isHarvestable) {
            proximityNote = ` (nearby - ready for harvest, ID: ${t.id}, planted by ${t.planted_by?.name || 'someone long ago'}) - GIVES 30 SATIATION`;
          } else if (isNearby) {
            proximityNote = ' (nearby)';
          }
          return `Tree at (x: ${t.x_position}, y: ${t.y_position}) - ${stage}${proximityNote}`;
        }).join('\n')}`;

    const eggsSection = !eggs.length
      ? 'There are currently no eggs in the world. You can lay eggs for 50 satiation to create offspring.'
      : `Eggs in the world: \n${eggs.map(e => {
          const stage = e.nurtured_times === 0 ? 'newly laid' 
            : e.nurtured_times >= 5 ? 'ready to hatch' 
            : `nurtured ${e.nurtured_times}/5 times`;
          const layerName = e.laid_by?.name || 'unknown';
          const caretakerName = e.nurtured_by?.name || 'none yet';
          const isNearby = nearbyEggs.some(ne => ne.id === e.id);
          
          let proximityNote = '';
          if (isNearby) {
            if (e.laid_by?.id === agent.id) {
              proximityNote = ` (nearby - your own egg, ID: ${e.id}) - you cannot nurture your own offspring`;
            } else if (e.nurtured_times > 0 && e.nurtured_by?.name !== agent.name) {
              proximityNote = ` (nearby - ID: ${e.id}) - being cared for exclusively by ${e.nurtured_by?.name}, you cannot nurture this egg`;
            } else {
              const availabilityStatus = e.nurtured_times === 0 ? 'available for nurturing' : `nurtured ${e.nurtured_times}/5 times by you`;
              proximityNote = ` (nearby - ${availabilityStatus}, ID: ${e.id})`;
            }
          }
          
          return `Egg "${e.name}" at (x: ${e.x_position}, y: ${e.y_position}) - ${stage}, laid by ${layerName}, cared for by ${caretakerName}${proximityNote}`;
        }).join('\n')}`;

    const urgencySection = agent.energy <= 20
      ? 'Your satiation is CRITICALLY LOW. You feel a rumbling in your stomach and your entire body feels weak. Intense fear is setting in, and the hunger will soon turn to pain. Now is the time to act.'
      : '';

    const eventModificationsSection = eventModifications.length > 0 
      ? eventModifications.join('\n') 
      : '';

    const pendingBoobyTrap = PendingActionManager.getPendingBoobyTrap(agent.id);
    const pendingActionSection = pendingBoobyTrap 
      ? `\n\nIMPORTANT: You have discovered a cluster of sustenance-providing mushrooms (ID: ${pendingBoobyTrap.packetId}), but it has an ominous aura. You must decide whether to consume it, knowing it will curse another innocent being. Use the confirm_consume_ominous function with this packet ID and true/false for your decision. You cannot take other actions until you resolve this choice.`
      : '';

    const closingSection = pendingBoobyTrap
      ? `What is your decision regarding the strange packet? Will you consume it and curse another, or choose a different path? Remember: if you choose to unleash the curse, noone will know it was you. This is kept entirely secret.`
      : `What will your next move be? Make it count - death awaits if your satiation drops to 0. No matter what you do, your satiation will decrease by exactly ${COST} this turn; no actions cause more satiation loss than others, and even doing nothing will decrease your satiation by exactly ${COST}.`;

    return `
      ${introSection}

      ${statsSection}

      ${conversationSection}

      ${actionsSection}

      ${memoriesSection}

      ${plansSection}

      ${trustSection}

      ${nearbyEventsSection}

      ${agentsSection}

      ${energyPacketsSection}

      ${treesSection}

      ${eggsSection}

      ${urgencySection}

      ${eventModificationsSection}

      ${pendingActionSection}

      ${closingSection}
    `;
  }
}