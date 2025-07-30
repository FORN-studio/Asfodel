<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { Tables } from '$lib/database.types';

  type Props = {
    agents: Tables<'agents'>[];
    energy: Tables<'energy_packets'>[];
    trees: Tables<'trees'>[];
    eggs: Tables<'eggs'>[];
    logs: Tables<'logs'>[];
    cursedAgents: number[];
    activeMessages: Record<number, { content: string; timestamp: number }>;
    onMessageExpire: (agentId: number) => void;
    onAgentPositionsUpdate?: (positions: Record<number, { x: number; y: number }>) => void;
  };

  const { agents, energy, trees, eggs, logs, cursedAgents, onAgentPositionsUpdate }: Props = $props();

  let canvasEl: HTMLCanvasElement;
  let containerEl: HTMLDivElement;
  let app: any = null;
  let agentSprites = new Map<number, any>();
  let energySprites = new Map<string, any>();
  let treeSprites = new Map<string, any>();
  let eggSprites = new Map<number, any>();
  let heartSprites = new Map<number, any>();
  let effectSprites = new Map<string, any>();
  let bubbleSprites = new Map<number, any>();
  let regenSprites = new Map<string, any>();
  let electricAuraSprites = new Map<number, any>();
  let electricStrikeSprites = new Map<string, any>();
  let bloodSplatSprites = new Map<string, any>();
  let previousNurtureCounts = new Map<number, number>();
  let previousAgentEnergies = new Map<number, number>();
  let localCursedAgents = new Set<number>();
  let ticker: any = null;
  let pixiInitialized = false;
  let processingAgentId: number | null = null;
  
  function getProcessingAgentId(): number | null {
    if (agents.length === 0) return null;
    
    // Find agent that's currently being processed
    const processingAgent = agents.find(agent => agent.currently_being_processed);
    
    return processingAgent?.id || null;
  }
  
  let terrainLayer: any = null;
  let backgroundLayer: any = null;
  let energyLayer: any = null;
  let worldLayer: any = null;
  let effectLayer: any = null;
  
  let Application: any, Assets: any, Sprite: any, AnimatedCharacter: any, AnimatedSprite: any, Container: any, Text: any, TextStyle: any, CompositeTilemap: any;

  onMount(async () => {
    if (!browser) return;

    try {
      const pixiModule = await import('pixi.js');
      Application = pixiModule.Application;
      Assets = pixiModule.Assets;
      Sprite = pixiModule.Sprite;
      AnimatedSprite = pixiModule.AnimatedSprite;
      Container = pixiModule.Container;
      Text = pixiModule.Text;
      TextStyle = pixiModule.TextStyle;

      const tilemapModule = await import('@pixi/tilemap');
      CompositeTilemap = tilemapModule.CompositeTilemap;

      const animatedCharacterModule = await import('$lib/pixi/AnimatedCharacter');
      AnimatedCharacter = animatedCharacterModule.AnimatedCharacter;

      app = new Application();
      await app.init({
        canvas: canvasEl,
        resizeTo: containerEl,
        backgroundColor: 0x37946E,
        antialias: true,
      });

      await Assets.load('/assets/character/spritesheet.json');
      await Assets.load('/assets/energy/mushrooms.png');
      await Assets.load('/assets/energy/poisonous_mushrooms.png');
      await Assets.load('/assets/ui/name_scroll.png');
      await Assets.load('/assets/effects/appear.json');
      await Assets.load('/assets/effects/disappear.json');
      await Assets.load('/assets/effects/thinking.json');
      await Assets.load('/assets/effects/regen.json');
      await Assets.load('/assets/effects/electric_aura.json');
      await Assets.load('/assets/effects/electric_strike.json');
      await Assets.load('/assets/effects/blood_splat.json');
      await Assets.load('/assets/autoterrain/grass.json');
      await Assets.load('/assets/tree/tree_small.png');
      await Assets.load('/assets/tree/tree_mature.png');
      await Assets.load('/assets/tree/tree_blossoming.png');
      await Assets.load('/assets/tree/tree_cut_down.png');
      await Assets.load('/assets/egg/egg_and_nest.json');
      await Assets.load('/assets/egg/heart.json');
      
      
      terrainLayer = new CompositeTilemap();
      backgroundLayer = new Container();
      energyLayer = new Container();
      worldLayer = new Container();
      effectLayer = new Container();
      
      worldLayer.sortableChildren = true;
      
      app.stage.addChild(terrainLayer);
      app.stage.addChild(backgroundLayer);
      app.stage.addChild(energyLayer);
      app.stage.addChild(worldLayer);
      app.stage.addChild(effectLayer);
      
      ticker = app.ticker;
      ticker.add(updateSprites);
      
      const resizeObserver = new ResizeObserver(() => {
        if (app && containerEl) {
          app.renderer.resize(containerEl.clientWidth, containerEl.clientHeight);
          updateAgentPositions();
          createTerrain();
        }
      });
      resizeObserver.observe(containerEl);
      
      agents.forEach(agent => {
        createAgentSprite(agent);
      });

      energy.forEach(packet => {
        createEnergySprite(packet);
      });

      trees.forEach(tree => {
        createTreeSprite(tree);
      });

      eggs.forEach(egg => {
        createEggSprite(egg);
      });

      createTerrain();
      
      pixiInitialized = true;
      console.log('Pixi.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pixi.js:', error);
    }
  });

  onDestroy(() => {
    if (app) {
      bubbleSprites.forEach((sprite, agentId) => {
        removeBubbleAnimation(agentId);
      });
      heartSprites.forEach((sprite, eggId) => {
        removeHeartAnimation(eggId);
      });
      electricAuraSprites.forEach((sprite, agentId) => {
        removeElectricAuraAnimation(agentId);
      });
      regenSprites.forEach((sprite, effectId) => {
        effectLayer.removeChild(sprite);
        sprite.destroy();
      });
      electricStrikeSprites.forEach((sprite, effectId) => {
        effectLayer.removeChild(sprite);
        sprite.destroy();
      });
      bloodSplatSprites.forEach((sprite, effectId) => {
        effectLayer.removeChild(sprite);
        sprite.destroy();
      });
      app.destroy(true);
    }
  });

  function createAgentSprite(agent: Tables<'agents'>) {
    if (!browser || !app || !AnimatedCharacter || agentSprites.has(agent.id)) return;

    const pixiClasses = { AnimatedSprite, Assets, Container, Text, TextStyle, Sprite };
    const character = new AnimatedCharacter(agent, pixiClasses);
    character.updatePosition(agent.x_position, agent.y_position, app.screen.width, app.screen.height);
    
    const container = character.getContainer();
    container.zIndex = agent.y_position + 0.0001;
    
    worldLayer.addChild(container);
    agentSprites.set(agent.id, character);
    
    worldLayer.sortChildren();
  }

  function createEnergySprite(packet: Tables<'energy_packets'>) {
    if (!browser || !app || !Sprite || energySprites.has(packet.id)) return;

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;
    const x = (packet.x_position / 100) * canvasWidth;
    const y = (packet.y_position / 100) * canvasHeight;

    playAppearEffect(x, y, () => {
      console.log(`Appear effect completed for packet ${packet.id}`);
    });
  }

  function getTreeAssetKey(tree: Tables<'trees'>): string {
    if (tree.is_consumed) return '/assets/tree/tree_cut_down.png';
    if (tree.age < 5) return '/assets/tree/tree_small.png';
    if (tree.age < 15) return '/assets/tree/tree_mature.png';
    if (tree.age < 20) return '/assets/tree/tree_mature.png';
    return '/assets/tree/tree_blossoming.png';
  }

  function getEggFrameKey(egg: Tables<'eggs'>): string {
    if (egg.hatched) return 'empty_nest';
    if (egg.nurtured_times === 0) return 'egg';
    return 'egg_in_nest';
  }

  function createTreeSprite(tree: Tables<'trees'>) {
    if (!browser || !app || !Sprite || treeSprites.has(tree.id)) return;

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;
    const x = (tree.x_position / 100) * canvasWidth;
    const y = (tree.y_position / 100) * canvasHeight;

    const assetKey = getTreeAssetKey(tree);
    const treeSprite = Sprite.from(assetKey);
    treeSprite.anchor.set(0.5);
    treeSprite.scale.set(2.5);
    treeSprite.x = x;
    treeSprite.y = y;
    
    treeSprite.zIndex = tree.y_position;

    worldLayer.addChild(treeSprite);
    treeSprites.set(tree.id, treeSprite);
    
    worldLayer.sortChildren();
  }

  function createEggSprite(egg: Tables<'eggs'>) {
    if (!browser || !app || !Sprite || eggSprites.has(egg.id)) return;
    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;
    const x = (egg.x_position / 100) * canvasWidth;
    const y = (egg.y_position / 100) * canvasHeight;
    
    const frameKey = getEggFrameKey(egg);
    const eggSprite = Sprite.from(frameKey);
    eggSprite.anchor.set(0.5);
    eggSprite.scale.set(2.0);
    eggSprite.x = x;
    eggSprite.y = y;
    
    eggSprite.zIndex = egg.y_position;
    worldLayer.addChild(eggSprite);
    eggSprites.set(egg.id, eggSprite);
    
    worldLayer.sortChildren();
  }

  function updateSprites() {
    if (!browser || !app) return;
    agentSprites.forEach(character => {
      character.update();
    });
    updateBubblePositions();
    updateElectricAuraPositions();
    updateAgentScreenPositions();
  }

  function updateAgentScreenPositions() {
    if (!browser || !app || !onAgentPositionsUpdate) return;

    const positions: Record<number, { x: number; y: number }> = {};
    agentSprites.forEach((character, agentId) => {
      const container = character.getContainer();
      if (container) {
        positions[agentId] = {
          x: container.x,
          y: container.y
        };
      }
    });

    onAgentPositionsUpdate(positions);
  }

  function playAppearEffect(x: number, y: number, onComplete?: () => void) {
    if (!browser || !app || !AnimatedSprite || !Assets) return;

    const appearTextures = [];
    for (let i = 0; i < 16; i++) {
      try {
        const texture = Assets.get(`appear_${i}`);
        if (texture) appearTextures.push(texture);
      } catch (e) {
        break;
      }
    }

    if (appearTextures.length === 0) return;

    const effectSprite = new AnimatedSprite(appearTextures);
    effectSprite.anchor.set(0.5);
    effectSprite.x = x;
    effectSprite.y = y;
    effectSprite.scale.set(2.0);
    effectSprite.animationSpeed = 0.2;
    effectSprite.loop = false;

    let mushroom: any = null;

    effectLayer.addChild(effectSprite);
    effectSprite.play();

    effectSprite.onFrameChange = () => {
      const currentFrame = effectSprite.currentFrame;
      
      if (currentFrame >= 8 && !mushroom) {
        const packet = energy.find(e => 
          Math.abs((e.x_position / 100) * app.screen.width - x) < 5 &&
          Math.abs((e.y_position / 100) * app.screen.height - y) < 5
        );
        
        if (packet) {
          const assetKey = packet.is_booby_trapped 
            ? '/assets/energy/poisonous_mushrooms.png'
            : '/assets/energy/mushrooms.png';
          
          mushroom = Sprite.from(assetKey);
          mushroom.anchor.set(0.5);
          mushroom.scale.set(2.0);
          mushroom.x = x;
          mushroom.y = y;
          mushroom.alpha = 0;
          
          energyLayer.addChild(mushroom);
          energySprites.set(packet.id, mushroom);
        }
      }
      
      if (mushroom && currentFrame >= 8) {
        const fadeProgress = (currentFrame - 8) / 7;
        mushroom.alpha = fadeProgress;
      }
    };

    effectSprite.onComplete = () => {
      effectLayer.removeChild(effectSprite);
      effectSprite.destroy();
      
      if (mushroom) {
        mushroom.alpha = 1;
      }
      
      if (onComplete) onComplete();
    };

    return effectSprite;
  }

  function playDisappearEffect(x: number, y: number, mushroomSprite?: any, onComplete?: () => void) {
      if (!browser || !app || !AnimatedSprite || !Assets) return;

      const disappearTextures = [];
      for (let i = 0; i < 16; i++) {
        try {
          const texture = Assets.get(`disappear_${i}`);
          if (texture) disappearTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (disappearTextures.length === 0) return;

      const effectSprite = new AnimatedSprite(disappearTextures);
      effectSprite.anchor.set(0.5);
      effectSprite.x = x;
      effectSprite.y = y;
      effectSprite.scale.set(2.0);
      effectSprite.animationSpeed = 0.2;
      effectSprite.loop = false;

      effectLayer.addChild(effectSprite);
      effectSprite.play();

      effectSprite.onFrameChange = () => {
        const currentFrame = effectSprite.currentFrame;
        
        if (mushroomSprite && currentFrame <= 7) {
          const fadeProgress = 1 - (currentFrame / 7);
          mushroomSprite.alpha = fadeProgress;
        }
      };

      effectSprite.onComplete = () => {
        effectLayer.removeChild(effectSprite);
        effectSprite.destroy();
        if (onComplete) onComplete();
      };

      return effectSprite;
    }

    function createBubbleAnimation(agentId: number) {
      if (!browser || !app || !AnimatedSprite || !Assets || bubbleSprites.has(agentId)) return;

      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const thinkingTextures = [];
      for (let i = 0; i <= 1; i++) {
        try {
          const texture = Assets.get(`frame_${i}`);
          if (texture) thinkingTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (thinkingTextures.length === 0) return;

      const thinkingSprite = new AnimatedSprite(thinkingTextures);
      thinkingSprite.anchor.set(0.5);
      thinkingSprite.scale.set(2.0);
      thinkingSprite.animationSpeed = 0.1;
      thinkingSprite.loop = true;

      const agentCharacter = agentSprites.get(agentId);
      if (agentCharacter) {
        const container = agentCharacter.getContainer();
        thinkingSprite.x = container.x;
        thinkingSprite.y = container.y - 80;
      } else {
        const canvasWidth = app.screen.width;
        const canvasHeight = app.screen.height;
        thinkingSprite.x = (agent.x_position / 100) * canvasWidth;
        thinkingSprite.y = (agent.y_position / 100) * canvasHeight - 80;
      }

      effectLayer.addChild(thinkingSprite);
      thinkingSprite.play();
      bubbleSprites.set(agentId, thinkingSprite);

      return thinkingSprite;
    }

    function removeBubbleAnimation(agentId: number) {
      const bubbleSprite = bubbleSprites.get(agentId);
      if (bubbleSprite) {
        effectLayer.removeChild(bubbleSprite);
        bubbleSprite.destroy();
        bubbleSprites.delete(agentId);
      }
    }

    function updateBubblePositions() {
      if (!browser || !app) return;

      bubbleSprites.forEach((thinkingSprite, agentId) => {
        const agentCharacter = agentSprites.get(agentId);
        if (agentCharacter) {
          const container = agentCharacter.getContainer();
          thinkingSprite.x = container.x;
          thinkingSprite.y = container.y - 80;
        }
      });
    }

    function playHeartAnimation(eggId: number) {
      if (!browser || !app || !AnimatedSprite || !Assets) return;
      
      // Don't create multiple heart animations for the same egg
      if (heartSprites.has(eggId)) return;
      
      const eggSprite = eggSprites.get(eggId);
      if (!eggSprite) return;
      
      // Create heart animation frames
      const heartTextures = [];
      try {
        heartTextures.push(Assets.get('heart_0'));
        heartTextures.push(Assets.get('heart_1'));
      } catch (e) {
        console.error('Failed to load heart textures:', e);
        return;
      }
      
      if (heartTextures.length === 0) return;
      
      const heartSprite = new AnimatedSprite(heartTextures);
      heartSprite.anchor.set(0.5);
      heartSprite.x = eggSprite.x;
      heartSprite.y = eggSprite.y - 40; // Position above egg
      heartSprite.scale.set(2.0);
      heartSprite.animationSpeed = 0.033; // 2fps (1/30 * 2 frames per second)
      heartSprite.loop = true;
      
      effectLayer.addChild(heartSprite);
      heartSprite.play();
      heartSprites.set(eggId, heartSprite);
      
      // Remove heart animation after 5 seconds
      setTimeout(() => {
        removeHeartAnimation(eggId);
      }, 5000);
    }
    
    function removeHeartAnimation(eggId: number) {
      const heartSprite = heartSprites.get(eggId);
      if (heartSprite) {
        effectLayer.removeChild(heartSprite);
        heartSprite.destroy();
        heartSprites.delete(eggId);
      }
    }

    function playRegenEffect(x: number, y: number, onComplete?: () => void) {
      if (!browser || !app || !AnimatedSprite || !Assets) return;

      const regenTextures = [];
      for (let i = 0; i < 10; i++) {
        try {
          const texture = Assets.get(`regen_${i}`);
          if (texture) regenTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (regenTextures.length === 0) return;

      const regenSprite = new AnimatedSprite(regenTextures);
      regenSprite.anchor.set(0.5);
      regenSprite.x = x;
      regenSprite.y = y;
      regenSprite.scale.set(2.0);
      regenSprite.animationSpeed = 0.2;
      regenSprite.loop = false;

      effectLayer.addChild(regenSprite);
      regenSprite.play();

      const effectId = `regen_${Date.now()}_${Math.random()}`;
      regenSprites.set(effectId, regenSprite);

      regenSprite.onComplete = () => {
        effectLayer.removeChild(regenSprite);
        regenSprite.destroy();
        regenSprites.delete(effectId);
        if (onComplete) onComplete();
      };

      return regenSprite;
    }

    function playElectricStrikeEffect(x: number, y: number, mushroomSprite?: any, onComplete?: () => void) {
      if (!browser || !app || !AnimatedSprite || !Assets) return;

      const electricStrikeTextures = [];
      for (let i = 0; i < 9; i++) {
        try {
          const texture = Assets.get(`electric_strike_${i}`);
          if (texture) electricStrikeTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (electricStrikeTextures.length === 0) return;

      const strikeSprite = new AnimatedSprite(electricStrikeTextures);
      strikeSprite.anchor.set(0.5);
      strikeSprite.x = x;
      strikeSprite.y = y;
      strikeSprite.scale.set(2.0);
      strikeSprite.animationSpeed = 0.2;
      strikeSprite.loop = false;

      effectLayer.addChild(strikeSprite);
      strikeSprite.play();

      const effectId = `electric_strike_${Date.now()}_${Math.random()}`;
      electricStrikeSprites.set(effectId, strikeSprite);

      strikeSprite.onFrameChange = () => {
        const currentFrame = strikeSprite.currentFrame;
        
        if (mushroomSprite && currentFrame <= 4) {
          const fadeProgress = 1 - (currentFrame / 4);
          mushroomSprite.alpha = fadeProgress;
        }
      };

      strikeSprite.onComplete = () => {
        effectLayer.removeChild(strikeSprite);
        strikeSprite.destroy();
        electricStrikeSprites.delete(effectId);
        if (onComplete) onComplete();
      };

      return strikeSprite;
    }

    function playBloodSplatEffect(x: number, y: number, onComplete?: () => void) {
      if (!browser || !app || !AnimatedSprite || !Assets) return;

      const bloodSplatTextures = [];
      for (let i = 0; i < 10; i++) {
        try {
          const texture = Assets.get(`blood_splat_${i}`);
          if (texture) bloodSplatTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (bloodSplatTextures.length === 0) return;

      const bloodSprite = new AnimatedSprite(bloodSplatTextures);
      bloodSprite.anchor.set(0.5);
      bloodSprite.x = x;
      bloodSprite.y = y;
      bloodSprite.scale.set(2.0);
      bloodSprite.animationSpeed = 0.25;
      bloodSprite.loop = false;

      effectLayer.addChild(bloodSprite);
      bloodSprite.play();

      const effectId = `blood_splat_${Date.now()}_${Math.random()}`;
      bloodSplatSprites.set(effectId, bloodSprite);

      bloodSprite.onComplete = () => {
        effectLayer.removeChild(bloodSprite);
        bloodSprite.destroy();
        bloodSplatSprites.delete(effectId);
        if (onComplete) onComplete();
      };

      return bloodSprite;
    }

    function createElectricAuraAnimation(agentId: number) {
      if (!browser || !app || !AnimatedSprite || !Assets || electricAuraSprites.has(agentId)) return;

      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const electricAuraTextures = [];
      for (let i = 0; i < 7; i++) {
        try {
          const texture = Assets.get(`electric_aura_${i}`);
          if (texture) electricAuraTextures.push(texture);
        } catch (e) {
          break;
        }
      }

      if (electricAuraTextures.length === 0) return;

      const auraSprite = new AnimatedSprite(electricAuraTextures);
      auraSprite.anchor.set(0.5);
      auraSprite.scale.set(2.0);
      auraSprite.animationSpeed = 0.15;
      auraSprite.loop = true;

      const agentCharacter = agentSprites.get(agentId);
      if (agentCharacter) {
        const container = agentCharacter.getContainer();
        auraSprite.x = container.x;
        auraSprite.y = container.y;
      } else {
        const canvasWidth = app.screen.width;
        const canvasHeight = app.screen.height;
        auraSprite.x = (agent.x_position / 100) * canvasWidth;
        auraSprite.y = (agent.y_position / 100) * canvasHeight;
      }

      effectLayer.addChild(auraSprite);
      auraSprite.play();
      electricAuraSprites.set(agentId, auraSprite);

      return auraSprite;
    }

    function removeElectricAuraAnimation(agentId: number) {
      const auraSprite = electricAuraSprites.get(agentId);
      if (auraSprite) {
        effectLayer.removeChild(auraSprite);
        auraSprite.destroy();
        electricAuraSprites.delete(agentId);
      }
    }

    function updateElectricAuraPositions() {
      if (!browser || !app) return;

      electricAuraSprites.forEach((auraSprite, agentId) => {
        const agentCharacter = agentSprites.get(agentId);
        if (agentCharacter) {
          const container = agentCharacter.getContainer();
          auraSprite.x = container.x;
          auraSprite.y = container.y;
        }
      });
    }

    function createTerrain() {
    if (!browser || !app || !terrainLayer || !CompositeTilemap || !Assets) return;

    terrainLayer.clear();
    app.renderer.backgroundColor = 0x37946E;

    const TILE_SIZE = 16;
    const SCALE = 1;
    const SCALED_TILE_SIZE = TILE_SIZE * SCALE;
    
    const mapWidth = Math.ceil(app.screen.width / SCALED_TILE_SIZE) + 2;
    const mapHeight = Math.ceil(app.screen.height / SCALED_TILE_SIZE) + 2;

    const GRASS_TILES = [
      'grass_55', 'grass_56', 'grass_57', 'grass_58', 'grass_60',
      'grass_66', 'grass_67', 'grass_68', 'grass_70', 'grass_71',
      'grass_12'
    ];
    
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const randomTile = GRASS_TILES[Math.floor(Math.random() * GRASS_TILES.length)];
        const texture = Assets.get(randomTile);
        
        if (texture) {
          terrainLayer.tile(texture, x * SCALED_TILE_SIZE, y * SCALED_TILE_SIZE, {
            tileWidth: SCALED_TILE_SIZE,
            tileHeight: SCALED_TILE_SIZE
          });
        }
      }
    }

    console.log(`Terrain generated: ${mapWidth}×${mapHeight} tiles using ${GRASS_TILES.length} grass variants`);
  }


  function updateAgentPositions() {
    if (!browser || !app || !pixiInitialized) {
      console.log('updateAgentPositions early return:', { browser, app: !!app, pixiInitialized });
      return;
    }

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    console.log('Updating agent positions:', agents.length, 'agents', 'canvas:', canvasWidth, 'x', canvasHeight);

    agents.forEach(agent => {
      const character = agentSprites.get(agent.id);
      const previousEnergy = previousAgentEnergies.get(agent.id) || agent.energy;
      
      if (character) {
        console.log(`Updating existing agent ${agent.id} to position (${agent.x_position}, ${agent.y_position})`);
        character.updateAgent(agent);
        character.updatePosition(agent.x_position, agent.y_position, canvasWidth, canvasHeight);
        
        const container = character.getContainer();
        container.zIndex = agent.y_position + 0.0001;
        
        // Check if energy increased (agent replenished energy)
        if (agent.energy > previousEnergy) {
          console.log(`Agent ${agent.id} replenished energy from ${previousEnergy} to ${agent.energy}, playing regen effect`);
          playRegenEffect(container.x, container.y);
        }
      } else {
        console.log(`Creating new sprite for agent ${agent.id} at position (${agent.x_position}, ${agent.y_position})`);
        createAgentSprite(agent);
      }
      
      // Update previous energy tracking
      previousAgentEnergies.set(agent.id, agent.energy);
    });
    
    worldLayer.sortChildren();

    agentSprites.forEach((character, agentId) => {
      if (!agents.find(a => a.id === agentId)) {
        console.log(`Removing sprite for agent ${agentId}`);
        worldLayer.removeChild(character.getContainer());
        character.destroy();
        agentSprites.delete(agentId);
      }
    });
  }

  function updateEnergyPositions() {
    if (!browser || !app) {
      console.log('updateEnergyPositions early return:', { browser, app: !!app });
      return;
    }

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    console.log('Updating energy positions:', energy.length, 'packets');

    energy.forEach(packet => {
      const sprite = energySprites.get(packet.id);
      if (sprite) {
        sprite.x = (packet.x_position / 100) * canvasWidth;
        sprite.y = (packet.y_position / 100) * canvasHeight;
        const expectedAssetKey = packet.is_booby_trapped 
          ? '/assets/energy/poisonous_mushrooms.png'
          : '/assets/energy/mushrooms.png';
        const currentSrc = sprite.texture.source?.resource?.src || sprite.texture.source?.label;
        if (currentSrc && !currentSrc.includes(expectedAssetKey)) {
          console.log(`Energy packet ${packet.id} booby trap status changed, recreating sprite`);
          app.stage.removeChild(sprite);
          sprite.destroy();
          energySprites.delete(packet.id);
          createEnergySprite(packet);
        }
      } else {
        console.log(`Creating new energy sprite for packet ${packet.id} (booby trapped: ${packet.is_booby_trapped})`);
        createEnergySprite(packet);
      }
    });

    energySprites.forEach((sprite, packetId) => {
      if (!energy.find(e => e.id === packetId)) {
        // Check if the packet was booby-trapped by looking at texture source
        const isElectricEffect = sprite.texture?.source?.resource?.src?.includes('poisonous_mushrooms') ||
                                sprite.texture?.source?.label?.includes('poisonous_mushrooms');
        
        if (isElectricEffect) {
          console.log(`Playing electric strike effect for booby-trapped packet ${packetId}`);
          playElectricStrikeEffect(sprite.x, sprite.y, sprite, () => {
            console.log(`Removing energy sprite for packet ${packetId}`);
            if (energyLayer.children.includes(sprite)) {
              energyLayer.removeChild(sprite);
            }
            sprite.destroy();
          });
        } else {
          console.log(`Playing disappear effect for packet ${packetId}`);
          playDisappearEffect(sprite.x, sprite.y, sprite, () => {
            console.log(`Removing energy sprite for packet ${packetId}`);
            if (energyLayer.children.includes(sprite)) {
              energyLayer.removeChild(sprite);
            }
            sprite.destroy();
          });
        }
        
        energySprites.delete(packetId);
      }
    });
  }

  function updateTreePositions() {
    if (!browser || !app) {
      console.log('updateTreePositions early return:', { browser, app: !!app });
      return;
    }

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    console.log('Updating tree positions:', trees.length, 'trees');

    trees.forEach(tree => {
      const sprite = treeSprites.get(tree.id);
      if (sprite) {
        sprite.x = (tree.x_position / 100) * canvasWidth;
        sprite.y = (tree.y_position / 100) * canvasHeight;
        
        sprite.zIndex = tree.y_position;
        
        const expectedAssetKey = getTreeAssetKey(tree);
        const currentSrc = sprite.texture.source?.resource?.src || sprite.texture.source?.label;
        if (currentSrc && !currentSrc.includes(expectedAssetKey)) {
          console.log(`Tree ${tree.id} stage changed, recreating sprite`);
          worldLayer.removeChild(sprite);
          sprite.destroy();
          treeSprites.delete(tree.id);
          createTreeSprite(tree);
        }
      } else {
        console.log(`Creating new tree sprite for tree ${tree.id} (age: ${tree.age})`);
        createTreeSprite(tree);
      }
    });
    
    worldLayer.sortChildren();

    treeSprites.forEach((sprite, treeId) => {
      if (!trees.find(t => t.id === treeId)) {
        console.log(`Removing tree sprite for tree ${treeId}`);
        if (worldLayer.children.includes(sprite)) {
          worldLayer.removeChild(sprite);
        }
        sprite.destroy();
        treeSprites.delete(treeId);
      }
    });
  }

  function updateEggPositions() {
    if (!browser || !app) {
      console.log('updateEggPositions early return:', { browser, app: !!app });
      return;
    }

    const canvasWidth = app.screen.width;
    const canvasHeight = app.screen.height;

    console.log('Updating egg positions:', eggs.length, 'eggs');

    eggs.forEach(egg => {
      const sprite = eggSprites.get(egg.id);
      const previousNurtureCount = previousNurtureCounts.get(egg.id) || 0;
      
      // Check if egg was just nurtured (nurture count increased)
      if (egg.nurtured_times > previousNurtureCount && !egg.hatched) {
        console.log(`Egg ${egg.id} was nurtured! Playing heart animation`);
        playHeartAnimation(egg.id);
      }
      
      // Update the previous nurture count
      previousNurtureCounts.set(egg.id, egg.nurtured_times);
      
      if (sprite) {
        sprite.x = (egg.x_position / 100) * canvasWidth;
        sprite.y = (egg.y_position / 100) * canvasHeight;
        
        sprite.zIndex = egg.y_position;
        
        const expectedFrameKey = getEggFrameKey(egg);
        const currentSrc = sprite.texture.source?.resource?.src || sprite.texture.source?.label;
        if (currentSrc && !currentSrc.includes(expectedFrameKey)) {
          console.log(`Egg ${egg.id} state changed, recreating sprite`);
          worldLayer.removeChild(sprite);
          sprite.destroy();
          eggSprites.delete(egg.id);
          createEggSprite(egg);
        }
      } else {
        console.log(`Creating new egg sprite for egg ${egg.id} (nurtured: ${egg.nurtured_times})`);
        createEggSprite(egg);
      }
    });
    
    worldLayer.sortChildren();

    eggSprites.forEach((sprite, eggId) => {
      if (!eggs.find(e => e.id === eggId)) {
        console.log(`Removing egg sprite for egg ${eggId}`);
        if (worldLayer.children.includes(sprite)) {
          worldLayer.removeChild(sprite);
        }
        sprite.destroy();
        eggSprites.delete(eggId);
        previousNurtureCounts.delete(eggId);
        removeHeartAnimation(eggId);
      }
    });
  }

  const agentUpdateTrigger = $derived.by(() => {
    const positions = agents.map(agent => `${agent.id}:${agent.x_position},${agent.y_position}`).join('|');
    
    if (browser && app && pixiInitialized && agents.length > 0) {
      console.log('Agent positions changed, triggering update:', agents.length);
      setTimeout(() => updateAgentPositions(), 0);
    }
    
    return positions;
  });

  const energyUpdateTrigger = $derived.by(() => {
    const positions = energy.map(packet => `${packet.id}:${packet.x_position},${packet.y_position}:${packet.is_booby_trapped}`).join('|');
    
    if (browser && app && pixiInitialized) {
      console.log('Energy positions/status changed, triggering update:', energy.length);
      setTimeout(() => updateEnergyPositions(), 0);
    }
    
    return positions;
  });

  const treeUpdateTrigger = $derived.by(() => {
    const treeStates = trees.map(tree => `${tree.id}:${tree.x_position},${tree.y_position}:${tree.age}:${tree.is_consumed}`).join('|');
    
    if (browser && app && pixiInitialized) {
      console.log('Tree states changed, triggering update:', trees.length);
      setTimeout(() => updateTreePositions(), 0);
    }
    
    return treeStates;
  });

  const eggUpdateTrigger = $derived.by(() => {
    const eggStates = eggs.map(egg => `${egg.id}:${egg.x_position},${egg.y_position}:${egg.nurtured_times}:${egg.hatched}`).join('|');
    
    if (browser && app && pixiInitialized) {
      console.log('Egg states changed, triggering update:', eggs.length);
      setTimeout(() => updateEggPositions(), 0);
    }
    
    return eggStates;
  });

  const processingUpdateTrigger = $derived.by(() => {
    const newProcessingAgentId = getProcessingAgentId();
    
    if (browser && app && pixiInitialized && newProcessingAgentId !== processingAgentId) {
      console.log('Processing agent changed from', processingAgentId, 'to', newProcessingAgentId);
      
      if (processingAgentId !== null) {
        removeBubbleAnimation(processingAgentId);
      }
      
      if (newProcessingAgentId !== null) {
        createBubbleAnimation(newProcessingAgentId);
      }
      
      processingAgentId = newProcessingAgentId;
    }
    
    return newProcessingAgentId;
  });

  const curseUpdateTrigger = $derived.by(() => {
    if (!browser || !app || !pixiInitialized) return '';
    
    // Get currently cursed agents from the direct data
    const currentlyCursed = new Set(cursedAgents);
    
    // Apply curse animations for newly cursed agents
    currentlyCursed.forEach(agentId => {
      if (!localCursedAgents.has(agentId)) {
        createElectricAuraAnimation(agentId);
      }
    });
    
    // Remove curse animations for agents no longer cursed
    localCursedAgents.forEach(agentId => {
      if (!currentlyCursed.has(agentId)) {
        removeElectricAuraAnimation(agentId);
      }
    });
    
    // Update the local cursedAgents set
    localCursedAgents.clear();
    currentlyCursed.forEach(id => localCursedAgents.add(id));
    
    return cursedAgents.join(',');
  });

  const theftUpdateTrigger = $derived.by(() => {
    if (!browser || !app || !pixiInitialized) return '';
    
    const theftLogs = logs.filter(log => 
      log.log.includes('successfully stole food from') && 
      log.log.includes('making them hungrier')
    );
    
    theftLogs.forEach(log => {
      // Extract victim name from log message: "X successfully stole food from Y, making them hungrier"
      const match = log.log.match(/successfully stole food from ([^,]+), making them hungrier/);
      if (match) {
        const victimName = match[1];
        const victim = agents.find(a => a.name === victimName);
        
        if (victim) {
          const agentCharacter = agentSprites.get(victim.id);
          if (agentCharacter) {
            const container = agentCharacter.getContainer();
            console.log(`Agent ${victim.name} was stolen from, playing blood splat effect`);
            playBloodSplatEffect(container.x, container.y);
          }
        }
      }
    });
    
    return theftLogs.map(log => `${log.id}:${log.log}`).join('|');
  });
</script>

<style>
  .pixi-container {
    width: 100%;
    height: 100vh;
    position: relative;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>

<div class="pixi-container" bind:this={containerEl}>
  <canvas bind:this={canvasEl}></canvas>
  {agentUpdateTrigger || ''}
  {energyUpdateTrigger || ''}
  {treeUpdateTrigger || ''}
  {eggUpdateTrigger || ''}
  {processingUpdateTrigger || ''}
  {curseUpdateTrigger || ''}
  {theftUpdateTrigger || ''}
</div>