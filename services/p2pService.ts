import { Peer, DataConnection } from 'peerjs';
import { P2PMessage } from '../types';

// Helper generate short ID (6 digits)
export const generateRoomId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

class P2PService {
    peer: Peer | null = null;
    connections: DataConnection[] = [];
    onDataCallback: ((data: P2PMessage, conn: DataConnection) => void) | null = null;
    onConnectionCallback: ((conn: DataConnection) => void) | null = null;

    initialize(id?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Clean up old peer if exists
            if (this.peer) {
                this.peer.destroy();
            }

            // Create new peer
            // Note: In production you might want your own PeerServer, but default cloud is fine for prototypes
            this.peer = new Peer(id ? id : undefined, {
                debug: 1
            });

            this.peer.on('open', (id) => {
                console.log('My Peer ID is: ' + id);
                resolve(id);
            });

            this.peer.on('connection', (conn) => {
                this.handleConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.error(err);
                reject(err);
            });
        });
    }

    connect(peerId: string): Promise<DataConnection> {
        return new Promise((resolve, reject) => {
            if (!this.peer) {
                this.initialize().then(() => {
                    this._connect(peerId, resolve, reject);
                });
            } else {
                this._connect(peerId, resolve, reject);
            }
        });
    }

    _connect(peerId: string, resolve: any, reject: any) {
        if (!this.peer) return;
        const conn = this.peer.connect(peerId);
        
        conn.on('open', () => {
            this.handleConnection(conn);
            resolve(conn);
        });

        conn.on('error', (err) => {
            reject(err);
        });

        // Timeout fallback
        setTimeout(() => {
            if (!conn.open) reject(new Error("Connection timeout"));
        }, 5000);
    }

    handleConnection(conn: DataConnection) {
        this.connections.push(conn);
        if (this.onConnectionCallback) {
            this.onConnectionCallback(conn);
        }

        conn.on('data', (data) => {
            if (this.onDataCallback) {
                this.onDataCallback(data as P2PMessage, conn);
            }
        });

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
        });
    }

    send(data: P2PMessage, conn?: DataConnection) {
        if (conn) {
            conn.send(data);
        } else {
            // Broadcast
            this.connections.forEach(c => {
                if(c.open) c.send(data);
            });
        }
    }

    onData(callback: (data: P2PMessage, conn: DataConnection) => void) {
        this.onDataCallback = callback;
    }

    onConnection(callback: (conn: DataConnection) => void) {
        this.onConnectionCallback = callback;
    }

    destroy() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections = [];
    }
}

export const p2pService = new P2PService();