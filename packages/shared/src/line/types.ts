// Minimal LINE Messaging API webhook types we use.
// See: https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects

export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export interface LineMessageBase {
  id: string;
  quoteToken?: string;
}

export interface LineTextMessage extends LineMessageBase {
  type: "text";
  text: string;
  mention?: {
    mentionees: Array<{
      index: number;
      length: number;
      userId?: string;
      type: "user" | "all";
      isSelf?: boolean;
    }>;
  };
}

export interface LineImageMessage extends LineMessageBase {
  type: "image";
  contentProvider: { type: "line" | "external"; originalContentUrl?: string };
}

export interface LineAudioMessage extends LineMessageBase {
  type: "audio";
  duration: number;
  contentProvider: { type: "line" | "external" };
}

export interface LineVideoMessage extends LineMessageBase {
  type: "video";
  duration: number;
  contentProvider: { type: "line" | "external" };
}

export interface LineFileMessage extends LineMessageBase {
  type: "file";
  fileName: string;
  fileSize: number;
}

export interface LineLocationMessage extends LineMessageBase {
  type: "location";
  title?: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface LineStickerMessage extends LineMessageBase {
  type: "sticker";
  packageId: string;
  stickerId: string;
}

export type LineMessage =
  | LineTextMessage
  | LineImageMessage
  | LineAudioMessage
  | LineVideoMessage
  | LineFileMessage
  | LineLocationMessage
  | LineStickerMessage;

export interface LineMessageEvent {
  type: "message";
  webhookEventId: string;
  timestamp: number;
  source: LineSource;
  replyToken?: string;
  message: LineMessage;
}

export interface LineFollowEvent {
  type: "follow";
  webhookEventId: string;
  timestamp: number;
  source: LineSource;
  replyToken?: string;
}

export interface LineUnfollowEvent {
  type: "unfollow";
  webhookEventId: string;
  timestamp: number;
  source: LineSource;
}

export interface LineJoinEvent {
  type: "join";
  webhookEventId: string;
  timestamp: number;
  source: LineSource;
  replyToken?: string;
}

export type LineWebhookEvent =
  | LineMessageEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LineJoinEvent;

export interface LineWebhookPayload {
  destination: string;
  events: LineWebhookEvent[];
}
