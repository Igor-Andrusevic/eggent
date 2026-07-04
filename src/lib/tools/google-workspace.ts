import { gmail_v1, calendar_v3, tasks_v1, google } from "googleapis";
import { ensureAuthenticatedClient } from "@/lib/tools/google-auth";

// ============================================================
// Gmail Functions
// ============================================================

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  labelIds: string[];
}

export interface GmailMessageListItem {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
}

async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const auth = await ensureAuthenticatedClient();
  const gmail = new gmail_v1.Gmail({ auth });
  return gmail;
}

function extractHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const header = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function decodeBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = decodeBody(part);
        if (nested) return nested;
      }
    }
  }
  
  return "";
}

export async function gmailListEmails(
  query: string = "",
  maxResults: number = 10,
  labelIds?: string[]
): Promise<{ success: boolean; messages?: GmailMessageListItem[]; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
      labelIds,
    });
    
    const messages = listResponse.data.messages || [];
    
    if (messages.length === 0) {
      return { success: true, messages: [] };
    }
    
    const detailedMessages: GmailMessageListItem[] = [];
    
    for (const msg of messages) {
      if (!msg.id) continue;
      
      const detailResponse = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      
      const headers = detailResponse.data.payload?.headers || [];
      
      detailedMessages.push({
        id: msg.id,
        threadId: msg.threadId || "",
        from: extractHeader(headers, "From"),
        subject: extractHeader(headers, "Subject"),
        date: extractHeader(headers, "Date"),
        snippet: detailResponse.data.snippet || "",
        labelIds: detailResponse.data.labelIds || [],
        isUnread: (detailResponse.data.labelIds || []).includes("UNREAD"),
      });
    }
    
    return { success: true, messages: detailedMessages };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list emails",
    };
  }
}

export async function gmailReadEmail(
  messageId: string
): Promise<{ success: boolean; message?: GmailMessage; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    
    const msg = response.data;
    const headers = msg.payload?.headers || [];
    
    const message: GmailMessage = {
      id: msg.id || "",
      threadId: msg.threadId || "",
      from: extractHeader(headers, "From"),
      to: extractHeader(headers, "To"),
      subject: extractHeader(headers, "Subject"),
      date: extractHeader(headers, "Date"),
      snippet: msg.snippet || "",
      body: decodeBody(msg.payload || {}),
      labelIds: msg.labelIds || [],
    };
    
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read email",
    };
  }
}

export async function gmailSendEmail(
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string
): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    let threadId: string | undefined;
    let references = "";
    let inReplyTo = "";
    
    if (replyToMessageId) {
      const originalMsg = await gmail.users.messages.get({
        userId: "me",
        id: replyToMessageId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "References", "Subject"],
      });
      
      threadId = originalMsg.data.threadId || undefined;
      
      const originalHeaders = originalMsg.data.payload?.headers || [];
      const originalMessageId = extractHeader(originalHeaders, "Message-ID");
      const originalReferences = extractHeader(originalHeaders, "References");
      
      inReplyTo = originalMessageId;
      references = originalReferences
        ? `${originalReferences} ${originalMessageId}`
        : originalMessageId;
    }
    
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
    ];
    
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
    }
    if (references) {
      headers.push(`References: ${references}`);
    }
    
    const email = headers.join("\r\n") + "\r\n\r\n" + body;
    const encodedEmail = Buffer.from(email).toString("base64url");
    
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
        threadId,
      },
    });
    
    return {
      success: true,
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export async function gmailManageLabels(
  action: "add" | "remove" | "list",
  messageId?: string,
  labelIds?: string[]
): Promise<{ success: boolean; labels?: gmail_v1.Schema$Label[]; error?: string }> {
  try {
    const gmail = await getGmailClient();
    
    if (action === "list") {
      const response = await gmail.users.labels.list({ userId: "me" });
      return { success: true, labels: response.data.labels || [] };
    }
    
    if (!messageId || !labelIds || labelIds.length === 0) {
      return { success: false, error: "messageId and labelIds are required for add/remove actions" };
    }
    
    if (action === "add") {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds: labelIds },
      });
      return { success: true };
    }
    
    if (action === "remove") {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { removeLabelIds: labelIds },
      });
      return { success: true };
    }
    
    return { success: false, error: "Invalid action" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to manage labels",
    };
  }
}

// ============================================================
// Calendar Functions
// ============================================================

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  status?: string;
  htmlLink?: string;
}

async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const auth = await ensureAuthenticatedClient();
  const calendar = new calendar_v3.Calendar({ auth });
  return calendar;
}

export async function calendarListEvents(
  timeMin?: string,
  timeMax?: string,
  calendarId: string = "primary",
  maxResults: number = 20
): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
  try {
    const calendar = await getCalendarClient();
    
    const now = new Date();
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax = timeMax || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await calendar.events.list({
      calendarId,
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });
    
    const events = (response.data.items || []).map((event) => ({
      id: event.id || "",
      summary: event.summary || "(No title)",
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
      },
      attendees: event.attendees?.map((a) => ({
        email: a.email || "",
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      status: event.status || undefined,
      htmlLink: event.htmlLink || undefined,
    }));
    
    return { success: true, events };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list events",
    };
  }
}

export async function calendarCreateEvent(
  summary: string,
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string },
  description?: string,
  location?: string,
  attendees?: string[],
  calendarId: string = "primary"
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    const calendar = await getCalendarClient();
    
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        location,
        start: start.dateTime ? { dateTime: start.dateTime, timeZone: "UTC" } : { date: start.date },
        end: end.dateTime ? { dateTime: end.dateTime, timeZone: "UTC" } : { date: end.date },
        attendees: attendees?.map((email) => ({ email })),
      },
    });
    
    const event: CalendarEvent = {
      id: response.data.id || "",
      summary: response.data.summary || "",
      description: response.data.description || undefined,
      location: response.data.location || undefined,
      start: {
        dateTime: response.data.start?.dateTime || undefined,
        date: response.data.start?.date || undefined,
      },
      end: {
        dateTime: response.data.end?.dateTime || undefined,
        date: response.data.end?.date || undefined,
      },
      attendees: response.data.attendees?.map((a) => ({
        email: a.email || "",
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      status: response.data.status || undefined,
      htmlLink: response.data.htmlLink || undefined,
    };
    
    return { success: true, event };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create event",
    };
  }
}

export async function calendarUpdateEvent(
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: string[];
  },
  calendarId: string = "primary"
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
  try {
    const calendar = await getCalendarClient();
    
    const requestBody: calendar_v3.Schema$Event = {};
    
    if (updates.summary !== undefined) requestBody.summary = updates.summary;
    if (updates.description !== undefined) requestBody.description = updates.description;
    if (updates.location !== undefined) requestBody.location = updates.location;
    if (updates.start) {
      requestBody.start = updates.start.dateTime
        ? { dateTime: updates.start.dateTime, timeZone: "UTC" }
        : { date: updates.start.date };
    }
    if (updates.end) {
      requestBody.end = updates.end.dateTime
        ? { dateTime: updates.end.dateTime, timeZone: "UTC" }
        : { date: updates.end.date };
    }
    if (updates.attendees !== undefined) {
      requestBody.attendees = updates.attendees.map((email) => ({ email }));
    }
    
    const response = await calendar.events.update({
      calendarId,
      eventId,
      requestBody,
    });
    
    const event: CalendarEvent = {
      id: response.data.id || "",
      summary: response.data.summary || "",
      description: response.data.description || undefined,
      location: response.data.location || undefined,
      start: {
        dateTime: response.data.start?.dateTime || undefined,
        date: response.data.start?.date || undefined,
      },
      end: {
        dateTime: response.data.end?.dateTime || undefined,
        date: response.data.end?.date || undefined,
      },
      attendees: response.data.attendees?.map((a) => ({
        email: a.email || "",
        displayName: a.displayName || undefined,
        responseStatus: a.responseStatus || undefined,
      })),
      status: response.data.status || undefined,
      htmlLink: response.data.htmlLink || undefined,
    };
    
    return { success: true, event };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event",
    };
  }
}

export async function calendarDeleteEvent(
  eventId: string,
  calendarId: string = "primary"
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getCalendarClient();
    
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete event",
    };
  }
}

// ============================================================
// Google Tasks Functions
// ============================================================

export interface TaskList {
  id: string;
  title: string;
  updated: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: string;
  completed?: string;
  updated: string;
  parent?: string;
  position: string;
}

async function getTasksClient(): Promise<tasks_v1.Tasks> {
  const auth = await ensureAuthenticatedClient();
  const tasks = google.tasks({ version: "v1", auth });
  return tasks;
}

function resolveTaskListId(
  taskListId: string | undefined,
  lists: tasks_v1.Schema$TaskList[],
): string {
  if (taskListId && taskListId !== "@default") {
    return taskListId;
  }

  const defaultList = lists.find(
    (tl) => tl.title === "My Tasks" || tl.title === "Мои задачи" || tl.title === "Мой список задач",
  );

  if (defaultList?.id) {
    return defaultList.id;
  }

  if (lists[0]?.id) {
    return lists[0].id;
  }

  throw new Error("No task lists found. Create one in Google Tasks first.");
}

export async function taskListLists(): Promise<{ success: boolean; taskLists?: TaskList[]; error?: string }> {
  try {
    const tasks = await getTasksClient();
    const response = await tasks.tasklists.list({ maxResults: 100 });
    const taskLists = (response.data.items || []).map((tl) => ({
      id: tl.id || "",
      title: tl.title || "(No title)",
      updated: tl.updated || "",
    }));

    return { success: true, taskLists };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list task lists",
    };
  }
}

export async function tasksListTasks(
  taskListId: string = "@default",
  showCompleted: boolean = true,
  showHidden: boolean = true,
): Promise<{ success: boolean; tasks?: Task[]; error?: string }> {
  try {
    const tasks = await getTasksClient();
    const listsResponse = await tasks.tasklists.list({ maxResults: 100 });
    const resolvedId = resolveTaskListId(taskListId, listsResponse.data.items || []);

    const response = await tasks.tasks.list({
      tasklist: resolvedId,
      showCompleted,
      showHidden,
    });

    const items = (response.data.items || []).map((t) => ({
      id: t.id || "",
      title: t.title || "(No title)",
      notes: t.notes || undefined,
      due: t.due || undefined,
      status: t.status || "needsAction",
      completed: t.completed || undefined,
      updated: t.updated || "",
      parent: t.parent || undefined,
      position: t.position || "",
    }));

    return { success: true, tasks: items };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tasks",
    };
  }
}

export async function tasksCreateTask(
  title: string,
  notes?: string,
  due?: string,
  taskListId: string = "@default",
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const tasks = await getTasksClient();
    const listsResponse = await tasks.tasklists.list({ maxResults: 100 });
    const resolvedId = resolveTaskListId(taskListId, listsResponse.data.items || []);

    const requestBody: tasks_v1.Schema$Task = { title };
    if (notes) requestBody.notes = notes;
    if (due) requestBody.due = due;

    const response = await tasks.tasks.insert({
      tasklist: resolvedId,
      requestBody,
    });

    const task: Task = {
      id: response.data.id || "",
      title: response.data.title || "",
      notes: response.data.notes || undefined,
      due: response.data.due || undefined,
      status: response.data.status || "needsAction",
      completed: response.data.completed || undefined,
      updated: response.data.updated || "",
      position: response.data.position || "",
    };

    return { success: true, task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}

export async function taskUpdateTask(
  taskId: string,
  requestBody: tasks_v1.Schema$Task,
  taskListId: string = "@default",
): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const tasks = await getTasksClient();
    const listsResponse = await tasks.tasklists.list({ maxResults: 100 });
    const resolvedId = resolveTaskListId(taskListId, listsResponse.data.items || []);

    const response = await tasks.tasks.patch({
      tasklist: resolvedId,
      task: taskId,
      requestBody,
    });

    const task: Task = {
      id: response.data.id || "",
      title: response.data.title || "",
      notes: response.data.notes || undefined,
      due: response.data.due || undefined,
      status: response.data.status || "needsAction",
      completed: response.data.completed || undefined,
      updated: response.data.updated || "",
      position: response.data.position || "",
    };

    return { success: true, task };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task",
    };
  }
}

export async function taskDeleteTask(
  taskId: string,
  taskListId: string = "@default",
): Promise<{ success: boolean; error?: string }> {
  try {
    const tasks = await getTasksClient();
    const listsResponse = await tasks.tasklists.list({ maxResults: 100 });
    const resolvedId = resolveTaskListId(taskListId, listsResponse.data.items || []);

    await tasks.tasks.delete({
      tasklist: resolvedId,
      task: taskId,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete task",
    };
  }
}
