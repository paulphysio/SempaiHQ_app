import { supabase } from './supabaseClient';

/**
 * Push notification via the `send-push-notification` Supabase Edge Function
 * (Firebase FCM). Best-effort: failures are logged, never thrown, so a push
 * hiccup can't fail the action that triggered it (the in-app notification
 * row is the source of truth).
 */
export const sendPushNotification = async (userIds, title, body, data = {}) => {
  if (!userIds?.length) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      console.error('[sendPushNotification] No access token available');
      return;
    }
    const response = await fetch('https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/send-push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ userIds, title, body, data }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to send push notification');
  } catch (error) {
    console.error('[sendPushNotification] Error sending push notification:', error);
  }
};
