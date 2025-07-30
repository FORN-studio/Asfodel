export interface GameEvent {
  id: string;
  type: string;
  target_agent_id: number;
  trigger_on_agent_turn: boolean;
  trigger_condition?: string;
  data: Record<string, any>;
  created_at: string;
  expires_at?: string;
}

export interface EventEffect {
  modifyPrompt?: (prompt: string, agentId: number) => string;
  addActions?: () => string[];
  beforeActions?: (agentId: number) => Promise<void>;
  afterActions?: (agentId: number) => Promise<void>;
}

export interface EventProcessor {
  canProcess(event: GameEvent): boolean;
  process(event: GameEvent, agentId: number): Promise<EventEffect>;
}

export enum EventType {
  CURSE = 'curse',
  BLESSING = 'blessing',
  STATUS_EFFECT = 'status_effect',
  DELAYED_ACTION = 'delayed_action',
  TRIGGER = 'trigger'
}