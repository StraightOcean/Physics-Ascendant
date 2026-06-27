// ============================================================
// 局域网联机客户端网络层
// ============================================================

import type { NetworkMessage } from '@engine/network/NetworkMessages';

type MessageHandler = (msg: NetworkMessage) => void;

class NetworkClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private url: string = '';
  private reconnectTimer: number | null = null;
  public playerId: string = '';
  public roomId: string = '';
  public connected: boolean = false;

  connect(url: string): Promise<void> {
    this.disconnect();
    this.url = url;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('连接超时（请检查服务器地址或网络，国内连接Cloudflare可能较慢）'));
      }, 15000);
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as NetworkMessage;
            this.dispatch(msg);
          } catch (e) {
            console.error('解析服务端消息失败', e);
          }
        };
        this.ws.onclose = () => {
          this.connected = false;
          this.dispatch({ type: 'disconnected' } as NetworkMessage);
        };
        this.ws.onerror = () => {
          clearTimeout(timeout);
          this.connected = false;
          this.ws?.close();
          reject(new Error('无法连接到服务器'));
        };
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  send(msg: NetworkMessage) {
    console.log('📡 NetworkClient.send:', msg.type, 'ws:', !!this.ws, 'connected:', this.connected);
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('⚠️ 无法发送：ws或connected为false');
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const list = this.handlers.get(type);
    if (list) {
      const i = list.indexOf(handler);
      if (i >= 0) list.splice(i, 1);
    }
  }

  private dispatch(msg: NetworkMessage) {
    const list = this.handlers.get(msg.type);
    if (list) list.forEach(h => h(msg));
  }
}

export const networkClient = new NetworkClient();
