import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isCloudConfigured } from "./config.js?v=20260926a";
import { defaultState } from "./storage.js?v=20260926a";

const ROOM_KEY = "favorite_eat_room";

let client = null;
let channel = null;
let saveTimer = null;
let applyingRemote = false;

export function cloudReady() {
  return isCloudConfigured();
}

function getClient() {
  if (!cloudReady()) return null;
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export function getSavedRoomCode() {
  return localStorage.getItem(ROOM_KEY) || "";
}

export function rememberRoomCode(code) {
  if (code) localStorage.setItem(ROOM_KEY, code);
  else localStorage.removeItem(ROOM_KEY);
}

export function makeRoomCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizePayload(data) {
  return {
    ...defaultState(),
    ...data,
    couple: { a: "", b: "", ...(data?.couple || {}) },
    places: Array.isArray(data?.places) ? data.places : [],
    stats: { ...defaultState().stats, ...(data?.stats || {}) },
    unlockedBadges: Array.isArray(data?.unlockedBadges) ? data.unlockedBadges : [],
  };
}

export async function createRoom(state) {
  const sb = getClient();
  if (!sb) throw new Error("雲端尚未設定");

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeRoomCode();
    const payload = normalizePayload(state);
    const { error } = await sb.from("rooms").insert({
      code,
      payload,
      updated_at: new Date().toISOString(),
    });
    if (!error) {
      rememberRoomCode(code);
      return { code, payload };
    }
    if (error.code !== "23505") throw error; // unique violation → retry
  }
  throw new Error("無法建立房間，請再試一次");
}

export async function joinRoom(rawCode) {
  const sb = getClient();
  if (!sb) throw new Error("雲端尚未設定");

  const code = normalizeCode(rawCode);
  if (code.length < 4) throw new Error("房間碼太短");

  const { data, error } = await sb
    .from("rooms")
    .select("code, payload, updated_at")
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("找不到這個房間碼");

  rememberRoomCode(data.code);
  return {
    code: data.code,
    payload: normalizePayload(data.payload),
    updatedAt: data.updated_at,
  };
}

export async function loadRoom(code) {
  return joinRoom(code);
}

export async function pushRoom(code, state) {
  const sb = getClient();
  if (!sb || !code || applyingRemote) return;

  const payload = normalizePayload(state);
  const { error } = await sb
    .from("rooms")
    .update({
      payload,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);

  if (error) throw error;
}

export function schedulePush(code, state, onError) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await pushRoom(code, state);
    } catch (err) {
      console.error(err);
      onError?.(err);
    }
  }, 400);
}

export function subscribeRoom(code, onRemote) {
  const sb = getClient();
  if (!sb || !code) return () => {};

  unsubscribeRoom();

  channel = sb
    .channel(`room:${code}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `code=eq.${code}`,
      },
      (payload) => {
        applyingRemote = true;
        try {
          onRemote(normalizePayload(payload.new.payload), payload.new.updated_at);
        } finally {
          // small delay so our echo save doesn't fight
          setTimeout(() => {
            applyingRemote = false;
          }, 50);
        }
      }
    )
    .subscribe();

  return unsubscribeRoom;
}

export function unsubscribeRoom() {
  if (channel && client) {
    client.removeChannel(channel);
  }
  channel = null;
}

export function isApplyingRemote() {
  return applyingRemote;
}
