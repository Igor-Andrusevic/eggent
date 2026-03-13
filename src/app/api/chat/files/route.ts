import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import {
    getChatFiles,
    saveChatFile,
    deleteChatFile,
} from "@/lib/storage/chat-files-store";
import { getChat } from "@/lib/storage/chat-store";
import { importKnowledgeFile } from "@/lib/memory/knowledge";
import { getSettings } from "@/lib/storage/settings-store";

/**
 * GET /api/chat/files?chatId=xxx
 * List all files uploaded to a chat
 */
export async function GET(req: NextRequest) {
    const chatId = req.nextUrl.searchParams.get("chatId");

    if (!chatId) {
        return Response.json(
            { error: "chatId is required" },
            { status: 400 }
        );
    }

    try {
        const files = await getChatFiles(chatId);
        return Response.json({ files });
    } catch (error) {
        console.error("Error getting chat files:", error);
        return Response.json(
            { error: "Failed to get chat files" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chat/files
 * Upload a file to a chat (multipart/form-data)
 * Automatically imports the file into the project's knowledge base for semantic search
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const chatId = formData.get("chatId") as string;
        const file = formData.get("file") as File | null;

        if (!chatId) {
            return Response.json(
                { error: "chatId is required" },
                { status: 400 }
            );
        }

        if (!file) {
            return Response.json(
                { error: "file is required" },
                { status: 400 }
            );
        }

        // Save file to chat storage
        const buffer = Buffer.from(await file.arrayBuffer());
        const savedFile = await saveChatFile(chatId, buffer, file.name);

        // Get chat to find projectId
        const chat = await getChat(chatId);
        if (chat && chat.projectId) {
            try {
                // Copy file to project knowledge directory and import into vector DB
                const projectDir = path.join(process.cwd(), "data", "projects", chat.projectId);
                const knowledgeDir = path.join(projectDir, ".meta", "knowledge");

                // Ensure knowledge directory exists
                await fs.mkdir(knowledgeDir, { recursive: true });

                // Copy file to knowledge directory
                const knowledgeFilePath = path.join(knowledgeDir, file.name);
                await fs.writeFile(knowledgeFilePath, buffer);

                // Import into vector DB for semantic search
                const settings = await getSettings();
                const result = await importKnowledgeFile(knowledgeDir, chat.projectId, settings, file.name);

                console.log(`File ${file.name} imported to knowledge base:`, {
                    imported: result.imported,
                    skipped: result.skipped,
                    errors: result.errors.length
                });

                // Return file with knowledge import status
                return Response.json({
                    file: savedFile,
                    knowledgeImport: {
                        success: result.imported > 0,
                        chunksImported: result.imported,
                        errors: result.errors
                    }
                });
            } catch (error) {
                console.error("Error importing file to knowledge base:", error);
                // Return success for file save even if knowledge import failed
                return Response.json({
                    file: savedFile,
                    knowledgeImport: {
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
            }
        }

        return Response.json({ file: savedFile });
    } catch (error) {
        console.error("Error uploading chat file:", error);
        return Response.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/chat/files?chatId=xxx&filename=yyy
 * Delete a file from a chat
 */
export async function DELETE(req: NextRequest) {
    const chatId = req.nextUrl.searchParams.get("chatId");
    const filename = req.nextUrl.searchParams.get("filename");

    if (!chatId || !filename) {
        return Response.json(
            { error: "chatId and filename are required" },
            { status: 400 }
        );
    }

    try {
        const deleted = await deleteChatFile(chatId, filename);
        if (!deleted) {
            return Response.json(
                { error: "File not found" },
                { status: 404 }
            );
        }
        return Response.json({ success: true });
    } catch (error) {
        console.error("Error deleting chat file:", error);
        return Response.json(
            { error: "Failed to delete file" },
            { status: 500 }
        );
    }
}
