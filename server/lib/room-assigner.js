import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
let connected = false;

// Build replica config from environment variables
const replicas = [];
const names = (process.env.REPLICA_NAMES || "").split(",").map(x => x.trim()).filter(Boolean);
const urls = (process.env.REPLICA_PUBLIC_ENDPOINTS || "").split(",").map(x => x.trim()).filter(Boolean);
for (let i = 0; i < Math.max(names.length, urls.length); i++) {
  if (urls[i]) replicas.push({ name: names[i] || `replica-${i + 1}`, url: urls[i] });
}

async function connect() {
  if (!connected) {
    await redis.connect();
    connected = true;
  }
}

export async function registerRoomOwner(roomId) {
  await connect();
  const appName = process.env.APP_NAME;
  if (roomId && appName) {
    await redis.setEx(`room:owner:${roomId}`, 6 * 60 * 60, appName);
  }
}

export async function resolveRoomAssignment(roomId) {
  await connect();
  const appName = await redis.get(`room:owner:${roomId}`);
  const replica = replicas.find(r => r.name === appName);
  return replica ? { replicaName: replica.name, socketUrl: replica.url } : null;
}

export async function clearRoomOwner(roomId) {
  await connect();
  await redis.del(`room:owner:${roomId}`);
}
