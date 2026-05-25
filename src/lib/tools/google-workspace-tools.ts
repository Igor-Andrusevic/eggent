import { google } from "googleapis";
import { ensureAuthenticatedClient } from "@/lib/tools/google-auth";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString();
}

function formatEmailDate(internalDate?: string | null): string {
  if (!internalDate) return "unknown date";
  const ts = Number(internalDate);
  if (isNaN(ts)) return internalDate;
  return new Date(ts).toLocaleString();
}

// ============================================================
// Gmail tools
// ============================================================

export async function gmailListEmails(
  query: string,
  maxResults: number,
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.messages.list({
      userId: "me",
      q: query || undefined,
      maxResults: maxResults || 10,
    });

    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
      return query
        ? `No emails found matching: "${query}"`
        : "No emails found in inbox.";
    }

    const results: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      const headers = detail.data.payload?.headers ?? [];
      const from = headers.find((h) => h.name === "From")?.value ?? "unknown";
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
      const date = formatEmailDate(detail.data.internalDate);
      const isUnread = detail.data.labelIds?.includes("UNREAD") ?? false;

      results.push(
        `[${i + 1}] ${isUnread ? "🟢 " : "📖 "}${subject}\n` +
        `    From: ${from}\n` +
        `    Date: ${date}\n` +
        `    ID: ${msg.id}`,
      );
    }

    return `Found ${messages.length} email(s):\n\n${results.join("\n\n")}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gmailReadEmail(messageId: string): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const msg = res.data;
    const headers = msg.payload?.headers ?? [];
    const from = headers.find((h) => h.name === "From")?.value ?? "unknown";
    const to = headers.find((h) => h.name === "To")?.value ?? "unknown";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
    const date = headers.find((h) => h.name === "Date")?.value ?? "unknown";
    const labels = (msg.labelIds ?? []).join(", ");

    let body = "(no content)";
    if (msg.payload?.parts) {
      const textPart = msg.payload.parts.find(
        (p) => p.mimeType === "text/plain",
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    } else if (msg.payload?.body?.data) {
      body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
    }

    return (
      `From: ${from}\n` +
      `To: ${to}\n` +
      `Subject: ${subject}\n` +
      `Date: ${date}\n` +
      `Labels: ${labels}\n` +
      `Thread ID: ${msg.threadId}\n` +
      `\n---\n\n${body}`
    );
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gmailSendEmail(
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  replyToThreadId?: string,
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const gmail = google.gmail({ version: "v1", auth });

    const headers: Record<string, string> = {
      To: to,
      Subject: subject,
      "Content-Type": "text/plain; charset=utf-8",
    };

    if (replyToMessageId) {
      headers["In-Reply-To"] = replyToMessageId;
      headers["References"] = replyToMessageId;
    }

    const messageParts: string[] = [];
    for (const [key, value] of Object.entries(headers)) {
      messageParts.push(`${key}: ${value}`);
    }
    messageParts.push("");
    messageParts.push(body);

    const raw = Buffer.from(messageParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        threadId: replyToThreadId,
      },
    });

    return `✅ Email sent successfully!\n\nTo: ${to}\nSubject: ${subject}\nMessage ID: ${res.data.id}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function gmailManageLabels(
  action: "list" | "add" | "remove",
  messageId?: string,
  labels?: string[],
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const gmail = google.gmail({ version: "v1", auth });

    if (action === "list") {
      const res = await gmail.users.labels.list({ userId: "me" });
      const labelList = res.data.labels ?? [];

      if (labelList.length === 0) {
        return "No labels found.";
      }

      return (
        `Found ${labelList.length} label(s):\n\n` +
        labelList
          .map((l) => `  ${l.name} (ID: ${l.id})${l.type === "system" ? " [system]" : ""}`)
          .join("\n")
      );
    }

    if (!messageId || !labels || labels.length === 0) {
      return "Error: message_id and label(s) required for add/remove actions.";
    }

    if (action === "add") {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds: labels },
      });
      return `✅ Added label(s) [${labels.join(", ")}] to message ${messageId}`;
    }

    if (action === "remove") {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { removeLabelIds: labels },
      });
      return `✅ Removed label(s) [${labels.join(", ")}] from message ${messageId}`;
    }

    return `Error: Unknown action "${action}". Use list, add, or remove.`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================
// Calendar tools
// ============================================================

export async function calendarListEvents(
  timeMin?: string,
  timeMax?: string,
  maxResults?: number,
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax =
      timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      maxResults: maxResults || 20,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items ?? [];

    if (events.length === 0) {
      return "No events found in this time range.";
    }

    const results = events.map((event, i) => {
      const isAllDay = event.start?.date != null;
      let timeStr: string;
      if (isAllDay) {
        timeStr = `${event.start?.date ?? "?"} (all day)`;
        if (event.end?.date && event.end.date !== event.start?.date) {
          timeStr += ` → ${event.end.date}`;
        }
      } else {
        timeStr = formatDate(event.start?.dateTime ?? "");
        if (event.end?.dateTime) {
          timeStr += ` → ${formatDate(event.end.dateTime)}`;
        }
      }

      const parts: string[] = [
        `[${i + 1}] ${event.summary ?? "(no title)"}`,
        `    Time: ${timeStr}`,
      ];
      if (event.location) parts.push(`    Location: ${event.location}`);
      if (event.attendees?.length) {
        const attList = event.attendees
          .map((a) => `${a.email} (${a.responseStatus ?? "unknown"})`)
          .join(", ");
        parts.push(`    Attendees: ${attList}`);
      }
      parts.push(`    ID: ${event.id}`);

      return parts.join("\n");
    });

    return `Found ${events.length} event(s):\n\n${results.join("\n\n")}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function calendarCreateEvent(
  summary: string,
  start: string,
  end: string,
  description?: string,
  location?: string,
  attendees?: string[],
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const isStartAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
    const isEndAllDay = /^\d{4}-\d{2}-\d{2}$/.test(end);

    const requestBody: Record<string, unknown> = {
      summary,
      start: isStartAllDay ? { date: start } : { dateTime: start },
      end: isEndAllDay ? { date: end } : { dateTime: end },
    };

    if (description) requestBody.description = description;
    if (location) requestBody.location = location;
    if (attendees && attendees.length > 0) {
      requestBody.attendees = attendees.map((email) => ({ email }));
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: requestBody as any,
    });

    return (
      `✅ Event created!\n\n` +
      `Title: ${summary}\n` +
      `Start: ${start}\n` +
      `End: ${end}\n` +
      `Event ID: ${res.data.id}\n` +
      `Link: ${res.data.htmlLink ?? "N/A"}`
    );
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function calendarUpdateEvent(
  eventId: string,
  summary?: string,
  start?: string,
  end?: string,
  description?: string,
  location?: string,
  attendees?: string[],
): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const calendar = google.calendar({ version: "v3", auth });

    const requestBody: Record<string, unknown> = {};

    if (summary) requestBody.summary = summary;
    if (description) requestBody.description = description;
    if (location) requestBody.location = location;

    if (start) {
      const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(start);
      requestBody.start = isAllDay ? { date: start } : { dateTime: start };
    }
    if (end) {
      const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(end);
      requestBody.end = isAllDay ? { date: end } : { dateTime: end };
    }

    if (attendees) {
      requestBody.attendees = attendees.map((email) => ({ email }));
    }

    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: requestBody as any,
    });

    const changes: string[] = [];
    if (summary) changes.push(`Title → "${summary}"`);
    if (start) changes.push(`Start → ${start}`);
    if (end) changes.push(`End → ${end}`);
    if (location) changes.push(`Location → ${location}`);

    return (
      `✅ Event updated!\n\n` +
      `Changes: ${changes.length > 0 ? changes.join(", ") : "none"}\n` +
      `Event ID: ${eventId}\n` +
      `Link: ${res.data.htmlLink ?? "N/A"}`
    );
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function calendarDeleteEvent(eventId: string): Promise<string> {
  try {
    const auth = await ensureAuthenticatedClient();
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    return `✅ Event deleted (ID: ${eventId})`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
