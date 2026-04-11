import OpenAI from "openai";

export const maxDuration = 30;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type FolderInfo = { id: string; name: string; description?: string };

const INLINE_SYSTEM = `以下のフォルダ一覧から、Snapの内容に最も適切なフォルダを1つ選んでください。
Snapの内容がどのフォルダにも全く当てはまらない場合のみ "0" と答えてください。
必ずフォルダの番号のみを出力してください（数字1文字のみ・前置き・説明不要）。

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

    // 番号付きリスト（IDではなく番号で選択させる）
    const folderList = folders
      .map((f, i) =>
        `${i + 1}. 名前: "${f.name}"${f.description ? ` | 説明: ${f.description}` : ""}`
      )
      .join("\n");

    const promptId = process.env.OPENAI_PROMPT_SNAP_TO_FOLDER;

    const userInput = `Snap内容: 「${snapContent.trim()}」`;

    const response = await client.responses.create(
      promptId
        ? {
            model: "gpt-4o-mini",
            prompt: {
              id: promptId,
              variables: { folder_list: folderList, snap_content: snapContent.trim() },
            },
            input: userInput,
            max_output_tokens: 16,
          }
        : {
            model: "gpt-4o-mini",
            instructions: INLINE_SYSTEM.replace("{{folder_list}}", folderList),
            input: userInput,
            max_output_tokens: 16,
          }
    );

    const raw = (response.output_text ?? "").trim();
    console.log("[snap-to-folder] raw output:", JSON.stringify(raw));

    // 先頭の数字を抽出（"1." "1\n" " 1 " なども対応）
    const match = raw.match(/\d+/);
    const num = match ? parseInt(match[0], 10) : 0;
    const folderId =
      num >= 1 && num <= folders.length
        ? folders[num - 1].id
        : null;

    console.log("[snap-to-folder] num:", num, "→ folderId:", folderId);
    return Response.json({ folderId });
  } catch (err) {
    console.error("[snap-to-folder] error:", err);
    return Response.json({ folderId: null });
  }
}
