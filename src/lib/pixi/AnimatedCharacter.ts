import type { Tables } from '$lib/database.types';

export class AnimatedCharacter {
  private sprite: any;
  private nameText: any;
  private hpText: any;
  private container: any;
  private agent: Tables<'agents'>;
  private targetX: number = 0;
  private targetY: number = 0;
  private isMoving: boolean = false;
  private currentDirection: 'down' | 'up' | 'left' | 'right' = 'down';
  private Assets: any;

  constructor(agent: Tables<'agents'>, pixiClasses: any) {
    const { AnimatedSprite, Assets, Container, Text, TextStyle, Sprite } = pixiClasses;
    
    this.agent = agent;
    this.Assets = Assets;
    this.container = new Container();
    
    this.createSprite(AnimatedSprite, Assets);
    this.createNameWithScroll(Text, TextStyle, Sprite);
    this.updatePosition(agent.x_position, agent.y_position);
  }

  private createSprite(AnimatedSprite: any, Assets: any) {
    const downTextures = [];
    for (let i = 0; i < 4; i++) {
      downTextures.push(Assets.get(`sprite_${i}`));
    }

    this.sprite = new AnimatedSprite(downTextures);
    this.sprite.animationSpeed = 0.15;
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(2.3);
    this.sprite.gotoAndStop(0);
    this.container.addChild(this.sprite);
  }

  private createNameWithScroll(Text: any, TextStyle: any, Sprite: any) {
    const style = new TextStyle({
      fontFamily: 'Jersey 15',
      fontSize: 18,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'normal',
    });

    this.nameText = new Text({ text: `${this.agent.name} (${this.agent.energy}HP)`, style });
    this.nameText.anchor.set(0.5);
    this.nameText.y = 40;

    this.container.addChild(this.nameText);
  }

  public updateAgent(agent: Tables<'agents'>) {
    this.agent = agent;
    if (this.nameText) {
      this.nameText.text = `${this.agent.name} (${this.agent.energy}HP)`;
    }
    if (this.hpText) {
      this.hpText.text = `${agent.energy}HP`
    }
    this.updatePosition(agent.x_position, agent.y_position);
  }

  public updatePosition(x: number, y: number, canvasWidth: number = 800, canvasHeight: number = 600) {
    this.targetX = (x / 100) * canvasWidth;
    this.targetY = (y / 100) * canvasHeight;

    const distance = Math.sqrt(
      Math.pow(this.targetX - this.container.x, 2) + Math.pow(this.targetY - this.container.y, 2)
    );

    if (distance > 2) {
      this.startMoving();
    }
  }

  private startMoving() {
    if (!this.isMoving && this.sprite) {
      this.isMoving = true;
      this.sprite.play();
    }
  }

  private stopMoving() {
    if (this.isMoving && this.sprite) {
      this.isMoving = false;
      this.sprite.gotoAndStop(0);
    }
  }

  private setDirection(direction: 'down' | 'up' | 'left' | 'right') {
    if (this.currentDirection === direction) return;
    
    this.currentDirection = direction;
    
    const frameMap = { down: 0, up: 4, left: 8, right: 12 };
    const startFrame = frameMap[direction];
    
    const directionTextures = [];
    for (let i = 0; i < 4; i++) {
      directionTextures.push(this.Assets.get(`sprite_${startFrame + i}`));
    }
    
    const wasPlaying = this.sprite.playing;
    this.sprite.textures = directionTextures;
    
    if (wasPlaying) {
      this.sprite.play();
    } else {
      this.sprite.gotoAndStop(0);
    }
  }

  public update() {
    if (!this.container) return;

    const dx = this.targetX - this.container.x;
    const dy = this.targetY - this.container.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 2) {
      const speed = 2;
      const moveX = (dx / distance) * speed;
      const moveY = (dy / distance) * speed;
      
      this.container.x += moveX;
      this.container.y += moveY;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDx > absDy) {
        this.setDirection(dx > 0 ? 'right' : 'left');
      } else {
        this.setDirection(dy > 0 ? 'down' : 'up');
      }

      this.startMoving();
    } else {
      this.container.x = this.targetX;
      this.container.y = this.targetY;
      this.stopMoving();
    }
  }

  public getAgent() {
    return this.agent;
  }

  public getContainer() {
    return this.container;
  }

  public setIdleAnimation() {
    this.stopMoving();
  }

  public setWalkingAnimation() {
    this.startMoving();
  }

  public setActionAnimation() {
    if (this.sprite) {
      this.sprite.animationSpeed = 0.25;
      this.sprite.play();
    }
  }

  public destroy() {
    [this.sprite, this.nameText, this.hpText, this.container].forEach(obj => obj?.destroy());
  }
}