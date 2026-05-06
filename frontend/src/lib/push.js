// Web Push helper - subscribe / unsubscribe / status
import api from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getRegistration() {
  if (!pushSupported()) return null;
  const reg =
    (await navigator.serviceWorker.getRegistration("/service-worker.js")) ||
    (await navigator.serviceWorker.register("/service-worker.js", { scope: "/" }));
  return reg;
}

export async function getCurrentSubscription() {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribePush() {
  if (!pushSupported()) throw new Error("Push não suportado neste navegador");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação negada");

  const reg = await getRegistration();
  if (!reg) throw new Error("Service Worker não disponível");

  // Get VAPID public key from backend
  const { data } = await api.get("/integrations/push/public-key");
  if (!data.configured || !data.publicKey) {
    throw new Error("Push notifications não configuradas no servidor");
  }

  // Reuse existing subscription if any
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  const json = sub.toJSON();
  await api.post("/integrations/push/subscribe", {
    endpoint: json.endpoint,
    keys: json.keys,
  });
  return sub;
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription();
  if (!sub) return false;
  const json = sub.toJSON();
  try {
    await api.post("/integrations/push/unsubscribe", {
      endpoint: json.endpoint,
      keys: json.keys || {},
    });
  } catch (e) {
    // ignore server failures, still try to unsubscribe locally
  }
  await sub.unsubscribe();
  return true;
}

export async function testPush() {
  const { data } = await api.post("/integrations/push/test");
  return data;
}
