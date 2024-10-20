import { readFile } from 'node:fs/promises'

export async function readFileOrDefault(filePath: string, defaultValue: string) {
  try {
    const data = await readFile(filePath, 'utf8')
    return data
  } catch (err) {
    if (err.code === 'ENOENT') {
      return defaultValue
    } else {
      console.error(`Error reading file: ${err}`)
      throw err
    }
  }
}
