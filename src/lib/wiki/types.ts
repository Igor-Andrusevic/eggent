export type WikiPageCategory = "sources" | "entities" | "concepts" | "synthesis";

export interface WikiPage {
  category: WikiPageCategory;
  name: string;
  filePath: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceFile?: string;
}

export interface WikiIndexEntry {
  category: WikiPageCategory;
  name: string;
  relativePath: string;
  summary: string;
  updatedAt: string;
  sourceCount?: number;
}

export interface WikiLogEntry {
  timestamp: string;
  operation: "ingest" | "query" | "lint" | "create_page" | "update_page" | "delete_page";
  detail: string;
  affectedPages: string[];
}

export interface WikiIngestResult {
  createdPages: string[];
  updatedPages: string[];
  errors: string[];
}

export interface WikiLintIssue {
  type: "orphan" | "stale" | "contradiction" | "missing_cross_reference" | "empty_page";
  pagePath: string;
  description: string;
  severity: "info" | "warning" | "error";
}

export interface WikiLintResult {
  issues: WikiLintIssue[];
  totalPages: number;
  checkedAt: string;
}
