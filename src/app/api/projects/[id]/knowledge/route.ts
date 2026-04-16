
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { importKnowledgeFile } from "@/lib/memory/knowledge";
import { deleteMemoryByMetadata, getChunkCountsByFilename } from "@/lib/memory/memory";
import { getProject } from "@/lib/storage/project-store";
import { getSettings } from "@/lib/storage/settings-store";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const projectDir = path.join(process.cwd(), "data", "projects", id);
    const knowledgeDir = path.join(projectDir, ".meta", "knowledge");

    try {
        await fs.access(knowledgeDir);
    } catch {
        return NextResponse.json([]);
    }

    try {
        const files = await fs.readdir(knowledgeDir);
        const chunkCounts = await getChunkCountsByFilename(id);
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const stats = await fs.stat(path.join(knowledgeDir, file));
                return {
                    name: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    chunkCount: chunkCounts[file] ?? 0,
                };
            })
        );
        return NextResponse.json(fileDetails);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to list knowledge files" },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Verify project exists
    const project = await getProject(id);
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const projectDir = path.join(process.cwd(), "data", "projects", id);
    const knowledgeDir = path.join(projectDir, ".meta", "knowledge");

    // Ensure knowledge directory exists
    await fs.mkdir(knowledgeDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = path.basename(file.name);
    if (!safeName) {
        return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const filePath = path.join(knowledgeDir, safeName);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(knowledgeDir);
    if (resolvedPath !== resolvedDir && !resolvedPath.startsWith(resolvedDir + path.sep)) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    try {
        // Save file
        await fs.writeFile(filePath, buffer);

        const settings = await getSettings();
        const result = await importKnowledgeFile(knowledgeDir, id, settings, safeName);

        if (result.errors.length > 0) {
            console.error("Ingestion errors:", result.errors);
            return NextResponse.json(
                {
                    message: "File saved but ingestion had errors",
                    details: result
                },
                { status: 207 }
            );
        }

        return NextResponse.json({
            message: "File uploaded and ingested successfully",
            filename: safeName
        });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Failed to process file" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Verify project exists
    const project = await getProject(id);
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    try {
        const { filename } = await req.json();

        if (!filename) {
            return NextResponse.json({ error: "Filename is required" }, { status: 400 });
        }

        const safeName = path.basename(filename);
        if (!safeName) {
            return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
        }

        const projectDir = path.join(process.cwd(), "data", "projects", id);
        const knowledgeDir = path.join(projectDir, ".meta", "knowledge");
        const filePath = path.join(knowledgeDir, safeName);

        const resolvedPath = path.resolve(filePath);
        const resolvedDir = path.resolve(knowledgeDir);
        if (resolvedPath !== resolvedDir && !resolvedPath.startsWith(resolvedDir + path.sep)) {
            return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
        }

        try {
            await fs.unlink(filePath);
        } catch (error: any) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }

        const deletedVectors = await deleteMemoryByMetadata("filename", safeName, id);

        return NextResponse.json({
            message: "File and vectors deleted successfully",
            deletedVectors
        });

    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json(
            { error: "Failed to delete file" },
            { status: 500 }
        );
    }
}
