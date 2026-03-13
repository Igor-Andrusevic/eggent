import fs from "fs/promises";
import path from "path";
import type { Project, ProjectAccessRules } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_DIR = path.join(DATA_DIR, "settings");
const PROJECT_ACCESS_FILE = path.join(SETTINGS_DIR, "project-access.json");

/**
 * Default access rules when file doesn't exist (backward compatibility).
 * Returns null to indicate "allow all" behavior.
 */
async function readAccessRulesFile(): Promise<ProjectAccessRules | null> {
  try {
    await fs.access(SETTINGS_DIR);
  } catch {
    // Settings directory doesn't exist yet
    return null;
  }

  try {
    const raw = await fs.readFile(PROJECT_ACCESS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as ProjectAccessRules;

    // Validate structure
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.adminUserIds)) return null;
    if (!parsed.projectAccess || typeof parsed.projectAccess !== "object") return null;

    return parsed;
  } catch (error) {
    // File doesn't exist or is invalid → use default "allow all" behavior
    return null;
  }
}

/**
 * Get project access rules.
 * Returns null if file doesn't exist (backward compatibility = all users can access all projects).
 */
export async function getProjectAccessRules(): Promise<ProjectAccessRules | null> {
  return readAccessRulesFile();
}

/**
 * Save project access rules.
 */
export async function saveProjectAccessRules(rules: ProjectAccessRules): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(SETTINGS_DIR, { recursive: true });

  // Add timestamp
  const rulesWithTimestamp: ProjectAccessRules = {
    ...rules,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    PROJECT_ACCESS_FILE,
    JSON.stringify(rulesWithTimestamp, null, 2),
    "utf-8"
  );
}

/**
 * Check if a user can access a specific project.
 * Returns true if:
 * - Access rules file doesn't exist (backward compatibility), OR
 * - User is in adminUserIds, OR
 * - User is in the project's allowedUserIds
 */
export async function canUserAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const rules = await getProjectAccessRules();

  // No rules file = backward compatibility = all users can access all projects
  if (!rules) return true;

  // Admin users can access everything
  if (rules.adminUserIds.includes(userId)) return true;

  // Check project-specific access
  const projectRules = rules.projectAccess[projectId];
  if (!projectRules) return false;

  return projectRules.allowedUserIds.includes(userId);
}

/**
 * Ensure user has access to at least one project.
 * If user has no access, automatically adds them to the "Прочее" project (0586339d).
 * This prevents issues when users are added via UI but not to project-access.json.
 */
export async function ensureUserHasProjectAccess(
  allProjects: Project[],
  userId: string
): Promise<void> {
  const rules = await getProjectAccessRules();

  // No rules file = backward compatibility, nothing to do
  if (!rules) return;

  // Admin users already have access
  if (rules.adminUserIds.includes(userId)) return;

  // Check if user has access to any project
  for (const project of allProjects) {
    if (await canUserAccessProject(userId, project.id)) {
      return; // User already has access
    }
  }

  // User has no access - add to "Прочее" project (0586339d) by default
  const otherProjectId = "0586339d";
  const otherProject = allProjects.find(p => p.id === otherProjectId);

  if (otherProject) {
    await addUserToProject(userId, otherProjectId);
  }
}

/**
 * Filter projects to only those accessible by the user.
 * If no rules file exists, returns all projects (backward compatibility).
 */
export async function getAccessibleProjects(
  allProjects: Project[],
  userId: string
): Promise<Project[]> {
  const rules = await getProjectAccessRules();

  // No rules file = backward compatibility = all projects accessible
  if (!rules) return allProjects;

  // Admin users see all projects
  if (rules.adminUserIds.includes(userId)) return allProjects;

  // Filter projects by access rules
  const accessibleProjects: Project[] = [];
  for (const project of allProjects) {
    if (await canUserAccessProject(userId, project.id)) {
      accessibleProjects.push(project);
    }
  }

  return accessibleProjects;
}

/**
 * Find the first accessible project for a user.
 * Returns null if no accessible projects exist.
 */
export async function getFirstAccessibleProject(
  allProjects: Project[],
  userId: string
): Promise<Project | null> {
  const accessible = await getAccessibleProjects(allProjects, userId);
  return accessible.length > 0 ? accessible[0] : null;
}

/**
 * Add a user to a project's access list.
 * Creates the project entry if it doesn't exist.
 */
export async function addUserToProject(
  userId: string,
  projectId: string
): Promise<void> {
  const rules = (await getProjectAccessRules()) || {
    adminUserIds: [],
    projectAccess: {},
  };

  if (!rules.projectAccess[projectId]) {
    rules.projectAccess[projectId] = { allowedUserIds: [] };
  }

  const projectRules = rules.projectAccess[projectId];
  if (!projectRules.allowedUserIds.includes(userId)) {
    projectRules.allowedUserIds.push(userId);
  }

  await saveProjectAccessRules(rules);
}

/**
 * Remove a user from a project's access list.
 */
export async function removeUserFromProject(
  userId: string,
  projectId: string
): Promise<void> {
  const rules = await getProjectAccessRules();
  if (!rules) return;

  const projectRules = rules.projectAccess[projectId];
  if (!projectRules) return;

  projectRules.allowedUserIds = projectRules.allowedUserIds.filter((id) => id !== userId);

  await saveProjectAccessRules(rules);
}

/**
 * Add a user to admin list.
 */
export async function addAdminUser(userId: string): Promise<void> {
  const rules = (await getProjectAccessRules()) || {
    adminUserIds: [],
    projectAccess: {},
  };

  if (!rules.adminUserIds.includes(userId)) {
    rules.adminUserIds.push(userId);
  }

  await saveProjectAccessRules(rules);
}

/**
 * Remove a user from admin list.
 */
export async function removeAdminUser(userId: string): Promise<void> {
  const rules = await getProjectAccessRules();
  if (!rules) return;

  rules.adminUserIds = rules.adminUserIds.filter((id) => id !== userId);

  await saveProjectAccessRules(rules);
}
