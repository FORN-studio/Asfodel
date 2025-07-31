import { PluginManager } from "./PluginManager";
import { MovementPlugin } from "./MovementPlugin";
import { CommunicationPlugin } from "./CommunicationPlugin";
import { CombatPlugin } from "./CombatPlugin";
import { ResourcePlugin } from "./ResourcePlugin";
import { SocialPlugin } from "./SocialPlugin";
import { MemoryPlugin } from "./MemoryPlugin";
import { PlanningPlugin } from "./PlanningPlugin";
import { AgriculturePlugin } from "./AgriculturePlugin";
import { ReproductionPlugin } from "./ReproductionPlugin";
import { TrustPlugin } from "./TrustPlugin";

let pluginManagerInstance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager();
    loadAllPlugins();
  }
  return pluginManagerInstance;
}

function loadAllPlugins(): void {
  if (!pluginManagerInstance) return;
  
  pluginManagerInstance.registerPlugin(new MovementPlugin());
  pluginManagerInstance.registerPlugin(new CommunicationPlugin());
  pluginManagerInstance.registerPlugin(new CombatPlugin());
  pluginManagerInstance.registerPlugin(new ResourcePlugin());
  pluginManagerInstance.registerPlugin(new SocialPlugin());
  pluginManagerInstance.registerPlugin(new MemoryPlugin());
  pluginManagerInstance.registerPlugin(new PlanningPlugin());
  pluginManagerInstance.registerPlugin(new AgriculturePlugin());
  pluginManagerInstance.registerPlugin(new ReproductionPlugin());
  pluginManagerInstance.registerPlugin(new TrustPlugin());
}