// Utility functions for PDF to CBT conversion

export const utilCloneJson = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

export const utilGetHash = async (buffer: Uint8Array): Promise<string> => {
  // Simple hash implementation for demo purposes
  let hash = 0
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i]
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(16)
}

export const utilIsPdfFile = async (file: File): Promise<number> => {
  // Check if file extension is .pdf
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 0
  }
  
  // Check if file type is application/pdf
  if (file.type !== 'application/pdf') {
    return 0
  }
  
  // Check PDF file signature (first few bytes should be %PDF)
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer.slice(0, 4))
    const signature = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
    
    if (signature === '%PDF') {
      return 1
    }
  } catch (error) {
    console.error('Error reading file signature:', error)
  }
  
  return 0
}

export const utilSelectiveMergeObj = (target: any, source: any): void => {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      target[key] = source[key]
    }
  }
}

export const utilClampNumber = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export const utilCompareVersion = (version1: string, version2: string): number => {
  const v1parts = version1.split('.').map(Number)
  const v2parts = version2.split('.').map(Number)
  
  const maxLength = Math.max(v1parts.length, v2parts.length)
  
  for (let i = 0; i < maxLength; i++) {
    const v1part = v1parts[i] || 0
    const v2part = v2parts[i] || 0
    
    if (v1part < v2part) return -1
    if (v1part > v2part) return 1
  }
  
  return 0
}

export const SEPARATOR = '_'

export const DataFileNames = {
  QuestionsPdf: 'questions.pdf',
  DataJson: 'data.json',
} as const

export type DataFileNames = typeof DataFileNames[keyof typeof DataFileNames]