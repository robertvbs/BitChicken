import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

export interface MarketChangedPayload {
  count: number;
  maxBlock: number;
}

export interface ForgeFulfilledPayload {
  requestId: string;
  tokenId: string;
  editionId: string;
}

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private connection: HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private subscribedAddresses = new Set<string>();

  private buildConnection(): HubConnection {
    const conn = new HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/events`)
      .withAutomaticReconnect()
      .build();
    conn.onreconnected(() => {
      for (const address of this.subscribedAddresses) {
        conn.invoke('Subscribe', address).catch((err) => {
          console.error('[SignalrService] resubscribe failed', err);
        });
      }
    });
    return conn;
  }

  async start(): Promise<void> {
    if (!this.connection) {
      this.connection = this.buildConnection();
    }
    const state = this.connection.state;
    if (state === HubConnectionState.Connected) return;
    if (this.startPromise) return this.startPromise;
    if (state === HubConnectionState.Connecting || state === HubConnectionState.Reconnecting) return;
    this.startPromise = this.connection.start()
      .catch((err) => {
        console.error('[SignalrService] connection failed', err);
      })
      .finally(() => {
        this.startPromise = null;
      });
    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (!this.connection) return;
    const state = this.connection.state;
    if (state === HubConnectionState.Disconnected || state === HubConnectionState.Disconnecting) return;
    try {
      await this.connection.stop();
    } catch (err) {
      console.error('[SignalrService] stop failed', err);
    }
  }

  async subscribe(address: string): Promise<void> {
    const key = address.toLowerCase();
    this.subscribedAddresses.add(key);
    if (!this.connection) {
      this.connection = this.buildConnection();
    }
    await this.start();
    if (this.connection.state !== HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('Subscribe', key);
    } catch (err) {
      console.error('[SignalrService] subscribe failed', err);
    }
  }

  async unsubscribe(address: string): Promise<void> {
    const key = address.toLowerCase();
    this.subscribedAddresses.delete(key);
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('Unsubscribe', key);
    } catch (err) {
      console.error('[SignalrService] unsubscribe failed', err);
    }
  }

  onMarketChanged(handler: (payload: MarketChangedPayload) => void): () => void {
    if (!this.connection) {
      this.connection = this.buildConnection();
    }
    this.connection.on('marketChanged', handler);
    return () => {
      this.connection?.off('marketChanged', handler);
    };
  }

  onForgeFulfilled(handler: (payload: ForgeFulfilledPayload) => void): () => void {
    if (!this.connection) {
      this.connection = this.buildConnection();
    }
    this.connection.on('forgeFulfilled', handler);
    return () => {
      this.connection?.off('forgeFulfilled', handler);
    };
  }
}
