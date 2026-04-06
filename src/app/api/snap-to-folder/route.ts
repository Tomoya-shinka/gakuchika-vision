import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export const maxDuration = 30;

type FolderInfo = { id: string; name: string; description?: string };

export async function POST(req: Request) {
  try {
    const { snapContent, folders } = (await req.json()) as {
      snapContent: string;
      folders: FolderInfo[];
    };

    if (!snapContent?.trim() || !folders?.length) {
      return Response.json({ folderId: null });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ folderId: null });
    }

    const folderList = folders
      .map((f, i) =>
        `${i + 1}. ID: "${f.id}" | 名前: "${f.name}"${f.description ? ` | 説明: ${f.description}` : ""}`
      )
      .join("\n");

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `以下のフォルダ一覧から、Snapの内容に最も適切なフォルダを1つ選んでください。
Snapの内容がどのフォルダにも明確に当てはまらない場合は "null" と答えてください。
必ずフォルダのIDのみを出力してください（ダブルクォート不要・前置き・説明不要）。

フォルダ一覧:
${folderList}`,
      prompt: `Snap内容: 「${snapContent.trim()}」`,
      maxOutputTokens: 60,
    });

    const raw = text.trim().replace(/^["']|["']$/g, "");
    const folderId = folders.some((f) => f.id === raw) ? raw : null;

    return Response.json({ folderId });
  } catch (err) {
    console.error("[snap-to-folder] error:", err);
    return Response.json({ folderId: null });
  }
}
