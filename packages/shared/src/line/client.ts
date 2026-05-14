/**
 * Thin LINE Messaging API client.
 * We avoid the `@line/bot-sdk` dep to keep dependencies small;
 * only the endpoints we actually use.
 */

const LINE_API_BASE = "https://api.line.me/v2/bot";
const LINE_DATA_BASE = "https://api-data.line.me/v2/bot";

export class LineClient {
  constructor(private readonly accessToken: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Push a message to a user, group, or room.
   * @param to LINE userId | groupId | roomId
   */
  async pushMessage(
    to: string,
    messages: Array<{ type: string; [k: string]: unknown }>
  ): Promise<void> {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ to, messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new LineApiError(`Push message failed: ${res.status} ${body}`);
    }
  }

  /**
   * Reply to an event using the replyToken (one-shot, expires ~1min).
   */
  async replyMessage(
    replyToken: string,
    messages: Array<{ type: string; [k: string]: unknown }>
  ): Promise<void> {
    const res = await fetch(`${LINE_API_BASE}/message/reply`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ replyToken, messages }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new LineApiError(`Reply message failed: ${res.status} ${body}`);
    }
  }

  /**
   * Fetch the binary content of an image/audio/video/file message.
   * Returns a fetch Response — caller is responsible for streaming the body.
   */
  async getMessageContent(messageId: string): Promise<Response> {
    const res = await fetch(`${LINE_DATA_BASE}/message/${messageId}/content`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new LineApiError(`Get content failed: ${res.status} ${body}`);
    }
    return res;
  }

  /**
   * Get profile of a user.
   * For group/room context use `getGroupMemberProfile(groupId, userId)` etc.
   */
  async getProfile(userId: string): Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
    language?: string;
  }> {
    const res = await fetch(`${LINE_API_BASE}/profile/${userId}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new LineApiError(`Get profile failed: ${res.status}`);
    }
    return res.json() as Promise<{
      userId: string;
      displayName: string;
      pictureUrl?: string;
      statusMessage?: string;
      language?: string;
    }>;
  }

  async getGroupMemberProfile(
    groupId: string,
    userId: string
  ): Promise<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  }> {
    const res = await fetch(
      `${LINE_API_BASE}/group/${groupId}/member/${userId}`,
      { headers: this.headers() }
    );
    if (!res.ok) {
      throw new LineApiError(`Get group profile failed: ${res.status}`);
    }
    return res.json() as Promise<{
      userId: string;
      displayName: string;
      pictureUrl?: string;
    }>;
  }
}

export class LineApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineApiError";
  }
}
