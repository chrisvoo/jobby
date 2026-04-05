import fs from 'fs'
import { getDocumentProxy, extractText } from 'unpdf'

export async function extractPdfText(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath)
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text.trim()
}
