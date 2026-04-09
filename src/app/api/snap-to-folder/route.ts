import OpenAI from "openai";

export const maxDuration = 30;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type FolderInfo = { id: string; name: string; description?: string };

const INLINE_SYSTEM = `以下のフォルダ一覧から、Snapの内容に最も適切なフォルダを1つ選んでください。
Snapの内容がどのフォルダにも明確に当てはまらない場合は "null" と答えてください。
必ずフォルダのIDのみを出力してください（ダブルクォート不要・前置き・説明不要）。

フォルダ一覧:
{{folder_list}}`;

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

    const promptId = process.env.OPENAI_PROMPT_SNAP_TO_FOLDER;

    const response = await client.responses.create(
      promptId
        ? {
            model: "gpt-4o-mini",
            prompt: {
              id: promptId,
              variables: {
                folder_list: folderList,
                snap_content: snapContent.trim(),
              },
            },
            max_output_tokens: 60,
          }
        : {
            model: "gpt-4o-mini",
            instructions: INLINE_SYSTEM.replace("{{folder_list}}", folderList),
            input: `Snap内容: 「${snapContent.trim()}」`,
            max_output_tokens: 60,
          }
    );

    const raw = (response.output_text ?? "").trim().replace(/^["']|["']$/g, "");

    // 完全一致を優先し、見つからなければ部分一致でフォールバック
    const folderId =
      folders.find((f) => f.id === raw)?.id ??
      folders.find((f) => raw.includes(f.id))?.id ??
      null;

    return Response.json({ folderId });
  } catch (err) {
    console.error("[snap-to-folder] error:", err);
    return Response.json({ folderId: null });
  }
}
