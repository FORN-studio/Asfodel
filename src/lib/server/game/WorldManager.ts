import { DatabaseService } from "../data/DatabaseService";
import { supabase } from "../supabase";

export class WorldManager {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomColor(): string {
    return `hsl(${this.randomInRange(0, 360)} ${this.randomInRange(0, 100)}% ${this.randomInRange(0, 100)}%)`;
  }

  async seed(): Promise<{ success: boolean }> {
    const AGENT_NAMES = [
      "Joseph",
      "Guldmund", 
      "Narcis",
      "Morrow",
      "Lulu",
      "Thorn",
      "Ember",
      "Kite",
      "Vale",
      "Echo",
    ];

    const queries = [];

    for (const name of AGENT_NAMES) {
      const query = this.db.createAgent(
        name,
        this.randomColor(),
        this.randomInRange(5, 95),
        this.randomInRange(5, 95)
      );
      queries.push(query);
    }

    for (let i = 0; i < 10; i++) {
      const isBoobyTrapped = Math.random() < 0.2;
      const query = this.db.createEnergyPacketWithTrap(
        this.randomInRange(5, 95),
        this.randomInRange(5, 95),
        isBoobyTrapped
      );
      queries.push(query);
    }

    for (let i = 0; i < 3; i++) {
      const query = this.db.createGoldChest(
        this.randomInRange(5, 95),
        this.randomInRange(5, 95)
      );
      queries.push(query);
    }

    await Promise.all(queries);

    return { success: true };
  }

  async reset(): Promise<{ success: boolean; error?: string }> {
    try {
      await Promise.all([
        supabase.from('agents').delete().neq('id', 0).throwOnError(),
        supabase.from('logs').delete().neq('id', 0).throwOnError(),
        supabase.from('energy_packets').delete().neq('id', '6e17b51f-3e0a-4571-9628-a1b80b5c77a6').throwOnError(),
        supabase.from('gold_chests').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError(),
        supabase.from('messages').delete().neq('id', 0).throwOnError(),
        supabase.from('agent_plans').delete().neq('id', 0).throwOnError(),
        supabase.from('trees').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError(),
        supabase.from('eggs').delete().neq('id', 0).throwOnError(),
        supabase.from('agent_trust').delete().neq('id', 0).throwOnError(),
      ]);
      return { success: true };
    } catch (err) {
      console.error('Reset failed:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : String(err) 
      };
    }
  }

  async spawnRandomEnergyPacket(): Promise<void> {
    const isBoobyTrapped = Math.random() < 0.2;
    await this.db.createEnergyPacketWithTrap(
      this.randomInRange(5, 95),
      this.randomInRange(5, 95),
      isBoobyTrapped
    );
  }

  async spawnRandomGoldChest(): Promise<void> {
    await this.db.createGoldChest(
      this.randomInRange(5, 95),
      this.randomInRange(5, 95)
    );
  }
}