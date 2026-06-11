import { EventEmitter } from 'events';

class NextRouterEvents extends EventEmitter {
  broadcast(type: string, data: any) {
    this.emit('event', { type, data, timestamp: new Date().toISOString() });
  }
}

// Global singleton
export const eventBus = new NextRouterEvents();
export default eventBus;
