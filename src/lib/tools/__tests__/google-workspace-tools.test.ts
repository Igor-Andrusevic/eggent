import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = { credentials: { access_token: "test-token" } };

let mockTasklistsList: ReturnType<typeof vi.fn>;
let mockTasksList: ReturnType<typeof vi.fn>;
let mockTasksInsert: ReturnType<typeof vi.fn>;
let mockTasksPatch: ReturnType<typeof vi.fn>;
let mockTasksDelete: ReturnType<typeof vi.fn>;

const { mockEnsureAuthenticatedClient } = vi.hoisted(() => ({
  mockEnsureAuthenticatedClient: vi.fn(),
}));

vi.mock("@/lib/tools/google-auth", () => ({
  ensureAuthenticatedClient: mockEnsureAuthenticatedClient,
}));

vi.mock("googleapis");

import { google } from "googleapis";
import { tasksListTasklists } from "@/lib/tools/google-workspace-tools";
import { tasksGetTasks } from "@/lib/tools/google-workspace-tools";
import { tasksCreate } from "@/lib/tools/google-workspace-tools";
import { tasksPatch } from "@/lib/tools/google-workspace-tools";
import { tasksDelete } from "@/lib/tools/google-workspace-tools";

beforeEach(() => {
  vi.resetAllMocks();
  mockEnsureAuthenticatedClient.mockResolvedValue(mockAuth);

  mockTasklistsList = vi.fn();
  mockTasksList = vi.fn();
  mockTasksInsert = vi.fn();
  mockTasksPatch = vi.fn();
  mockTasksDelete = vi.fn();

  vi.mocked(google.tasks).mockReturnValue({
    tasklists: { list: mockTasklistsList },
    tasks: {
      list: mockTasksList,
      insert: mockTasksInsert,
      patch: mockTasksPatch,
      delete: mockTasksDelete,
    },
  } as unknown as ReturnType<typeof google.tasks>);
});

describe("tasksListTasklists", () => {
  it("returns formatted list of tasklists", async () => {
    mockTasklistsList.mockResolvedValue({
      data: {
        items: [
          { id: "list-1", title: "My Tasks" },
          { id: "list-2", title: "Work" },
        ],
      },
    });

    const result = await tasksListTasklists();

    expect(result).toContain("[1] My Tasks (ID: list-1)");
    expect(result).toContain("[2] Work (ID: list-2)");
    expect(result).toContain("Found 2 task list(s)");
  });

  it("returns empty message when no tasklists exist", async () => {
    mockTasklistsList.mockResolvedValue({ data: { items: [] } });

    const result = await tasksListTasklists();

    expect(result).toBe("No task lists found.");
  });

  it("returns error message on API failure", async () => {
    mockTasklistsList.mockRejectedValue(new Error("Network error"));

    const result = await tasksListTasklists();

    expect(result).toBe("Error: Network error");
  });
});

describe("tasksGetTasks", () => {
  it("returns formatted list of tasks with @default resolved", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "default-id", title: "My Tasks" }] },
    });

    mockTasksList.mockResolvedValue({
      data: {
        items: [
          {
            id: "task-1",
            title: "Buy groceries",
            status: "needsAction",
            due: "2026-07-10T00:00:00.000Z",
          },
          {
            id: "task-2",
            title: "Done task",
            status: "completed",
          },
        ],
      },
    });

    const result = await tasksGetTasks("@default", true, false, 10);

    expect(mockTasklistsList).toHaveBeenCalledWith({ maxResults: 100 });
    expect(mockTasksList).toHaveBeenCalledWith({
      tasklist: "default-id",
      showCompleted: true,
      showHidden: false,
      maxResults: 10,
    });
    expect(result).toContain("[1] ⬜ Buy groceries");
    expect(result).toContain("ID: task-1");
    expect(result).toContain("Due: 2026-07-10T00:00:00.000Z");
    expect(result).toContain("[2] ✅ Done task");
    expect(result).toContain("Found 2 task(s)");
  });

  it("uses explicit tasklist ID without resolution", async () => {
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("custom-list-id", false, false, 5);

    expect(mockTasklistsList).not.toHaveBeenCalled();
    expect(mockTasksList).toHaveBeenCalledWith({
      tasklist: "custom-list-id",
      showCompleted: false,
      showHidden: false,
      maxResults: 5,
    });
  });

  it("truncates notes to 100 characters", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });

    const notes = "ABCDEFGHIJ".repeat(10);
    mockTasksList.mockResolvedValue({
      data: {
        items: [
          {
            id: "task-note",
            title: "Note task",
            status: "needsAction",
            notes,
          },
        ],
      },
    });

    const result = await tasksGetTasks("@default", true, false, 10);

    expect(result).toContain(`Notes: ${notes.substring(0, 100)}`);
  });

  it("returns empty message for empty task list", async () => {
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    const result = await tasksGetTasks("some-id", false, false, 10);

    expect(result).toBe("No tasks found in this list.");
  });

  it("returns error on resolveTaskListId failure (no lists)", async () => {
    mockTasklistsList.mockResolvedValue({ data: { items: [] } });

    const result = await tasksGetTasks("@default", false, false, 10);

    expect(result).toBe("Error: No task lists found. Create one in Google Tasks first.");
  });

  it("returns error on API failure", async () => {
    mockTasksList.mockRejectedValue(new Error("Permission denied"));

    const result = await tasksGetTasks("id", false, false, 10);

    expect(result).toBe("Error: Permission denied");
  });
});

describe("resolveTaskListId", () => {
  it("resolves @default to 'My Tasks'", async () => {
    mockTasklistsList.mockResolvedValue({
      data: {
        items: [
          { id: "other", title: "Shopping" },
          { id: "my-tasks-id", title: "My Tasks" },
        ],
      },
    });
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("@default", false, false, 10);

    expect(mockTasksList).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "my-tasks-id" }),
    );
  });

  it("resolves @default to 'Мои задачи'", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "ru-tasks", title: "Мои задачи" }] },
    });
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("@default", false, false, 10);

    expect(mockTasksList).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "ru-tasks" }),
    );
  });

  it("resolves @default to 'Мой список задач'", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "ru-list", title: "Мой список задач" }] },
    });
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("@default", false, false, 10);

    expect(mockTasksList).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "ru-list" }),
    );
  });

  it("falls back to first available list when no named match", async () => {
    mockTasklistsList.mockResolvedValue({
      data: {
        items: [
          { id: "custom-1", title: "Custom List" },
          { id: "custom-2", title: "Another" },
        ],
      },
    });
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("@default", false, false, 10);

    expect(mockTasksList).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "custom-1" }),
    );
  });

  it("resolves empty string to first list", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "first", title: "My Tasks" }] },
    });
    mockTasksList.mockResolvedValue({ data: { items: [] } });

    await tasksGetTasks("", false, false, 10);

    expect(mockTasksList).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "first" }),
    );
  });
});

describe("tasksCreate", () => {
  it("creates a task with title only", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "new-task-1", title: "Test task", due: undefined },
    });

    const result = await tasksCreate("@default", "Test task");

    expect(mockTasksInsert).toHaveBeenCalledWith({
      tasklist: "dl",
      requestBody: { title: "Test task", notes: "Created by Eggent AI" },
    });
    expect(result).toContain("Задача 'Test task' успешно создана");
    expect(result).toContain("ID: new-task-1");
  });

  it("creates a task with YYYY-MM-DD due date", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "t1", title: "Deadline task", due: "2026-12-31T00:00:00.000Z" },
    });

    const result = await tasksCreate("@default", "Deadline task", "2026-12-31");

    expect(mockTasksInsert).toHaveBeenCalledWith({
      tasklist: "dl",
      requestBody: {
        title: "Deadline task",
        due: "2026-12-31T00:00:00.000Z",
        notes: "Created by Eggent AI",
      },
    });
    expect(result).toContain("Срок: 2026-12-31T00:00:00.000Z");
  });

  it("creates a task with ISO due date", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "t2", title: "ISO task", due: "2026-07-15T14:30:00.000Z" },
    });

    await tasksCreate("@default", "ISO task", "2026-07-15T14:30:00.000Z");

    expect(mockTasksInsert).toHaveBeenCalledWith({
      tasklist: "dl",
      requestBody: {
        title: "ISO task",
        due: "2026-07-15T14:30:00.000Z",
        notes: "Created by Eggent AI",
      },
    });
  });

  it("creates a task with custom notes", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "t3", title: "Noted task" },
    });

    await tasksCreate("@default", "Noted task", undefined, "Custom note");

    expect(mockTasksInsert).toHaveBeenCalledWith({
      tasklist: "dl",
      requestBody: {
        title: "Noted task",
        notes: "Custom note\n\nCreated by Eggent AI",
      },
    });
  });

  it("creates a task with explicit tasklist ID", async () => {
    mockTasksInsert.mockResolvedValue({
      data: { id: "t4", title: "Explicit list task" },
    });

    await tasksCreate("explicit-id", "Explicit list task");

    expect(mockTasklistsList).not.toHaveBeenCalled();
    expect(mockTasksInsert).toHaveBeenCalledWith({
      tasklist: "explicit-id",
      requestBody: { title: "Explicit list task", notes: "Created by Eggent AI" },
    });
  });

  it("returns error on API failure", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksInsert.mockRejectedValue(new Error("Quota exceeded"));

    const result = await tasksCreate("@default", "Fail task");

    expect(result).toBe("Error: Quota exceeded");
  });
});

describe("tasksPatch", () => {
  it("marks task as completed", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-x", title: "Completed task" },
    });

    const result = await tasksPatch("@default", "task-x", "completed");

    expect(mockTasksPatch).toHaveBeenCalledWith({
      tasklist: "dl",
      task: "task-x",
      requestBody: { status: "completed" },
    });
    expect(result).toContain("Задача 'Completed task' успешно выполнена");
  });

  it("updates task title", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-y", title: "New title" },
    });

    const result = await tasksPatch("@default", "task-y", undefined, "New title");

    expect(mockTasksPatch).toHaveBeenCalledWith({
      tasklist: "dl",
      task: "task-y",
      requestBody: { title: "New title" },
    });
    expect(result).toContain("Задача 'New title' успешно обновлена");
  });

  it("updates due date with YYYY-MM-DD format", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-d", title: "Dated" },
    });

    await tasksPatch("@default", "task-d", undefined, undefined, "2026-08-01");

    expect(mockTasksPatch).toHaveBeenCalledWith({
      tasklist: "dl",
      task: "task-d",
      requestBody: { due: "2026-08-01T00:00:00.000Z" },
    });
  });

  it("removes due date when empty string passed", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-e", title: "Undated" },
    });

    await tasksPatch("@default", "task-e", undefined, undefined, "");

    expect(mockTasksPatch).toHaveBeenCalledWith({
      tasklist: "dl",
      task: "task-e",
      requestBody: { due: null },
    });
  });

  it("uses explicit tasklist ID", async () => {
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-f", title: "Explicit patch" },
    });

    await tasksPatch("explicit-list", "task-f", "needsAction", "Explicit patch");

    expect(mockTasklistsList).not.toHaveBeenCalled();
    expect(mockTasksPatch).toHaveBeenCalledWith(
      expect.objectContaining({ tasklist: "explicit-list" }),
    );
  });

  it("returns error on API failure", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockRejectedValue(new Error("Not found"));

    const result = await tasksPatch("@default", "bad-id", "completed");

    expect(result).toBe("Error: Not found");
  });

  it("says 'обновлена' for needsAction status", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksPatch.mockResolvedValue({
      data: { id: "task-g", title: "Reopened" },
    });

    const result = await tasksPatch("@default", "task-g", "needsAction");

    expect(result).toContain("Задача 'Reopened' успешно обновлена");
  });
});

describe("tasksDelete", () => {
  it("deletes task successfully", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksDelete.mockResolvedValue({});

    const result = await tasksDelete("@default", "task-to-delete");

    expect(mockTasksDelete).toHaveBeenCalledWith({
      tasklist: "dl",
      task: "task-to-delete",
    });
    expect(result).toBe("Задача успешно удалена");
  });

  it("uses explicit tasklist ID", async () => {
    mockTasksDelete.mockResolvedValue({});

    await tasksDelete("explicit-list-id", "task-del");

    expect(mockTasklistsList).not.toHaveBeenCalled();
    expect(mockTasksDelete).toHaveBeenCalledWith({
      tasklist: "explicit-list-id",
      task: "task-del",
    });
  });

  it("returns error on API failure", async () => {
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "dl", title: "My Tasks" }] },
    });
    mockTasksDelete.mockRejectedValue(new Error("Forbidden"));

    const result = await tasksDelete("@default", "protected-task");

    expect(result).toBe("Error: Forbidden");
  });
});
