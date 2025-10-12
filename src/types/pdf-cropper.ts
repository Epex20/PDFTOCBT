export interface PdfCropperCoords {
  l: number // left
  r: number // right
  t: number // top
  b: number // bottom
  page: number
}

export interface PdfData {
  page: number
  x: number
  y: number
  w: number
  h: number
}

export interface QuestionData {
  que: number | string
  subject: string
  section: string
  answerOptions: string
  type: 'mcq' | 'msm'
  marks: {
    cm: number // correct marks
    pm?: number // partial marks
    im: number // incorrect marks
  }
  pdfData: PdfData[]
  answerOptionsCounterType?: {
    primary?: string
    secondary?: string
  }
}

export interface CropperOutputData {
  [subject: string]: {
    [section: string]: {
      [question: string]: QuestionData
    }
  }
}

export interface TestConfig {
  pdfFileHash: string
  zipOriginalUrl?: string
  zipConvertedUrl?: string
  zipUrl?: string
  optionalQuestions?: Array<{
    subject: string
    section: string
    count: number
  }>
}

export interface PdfCropperJsonOutput {
  testConfig: TestConfig
  pdfCropperData: CropperOutputData
  appVersion: string
  generatedBy: 'pdfCropperPage'
}

export interface TestImageBlobs {
  [section: string]: {
    [question: string]: Blob[]
  }
}

export interface PageImgData {
  [pageNum: number]: {
    width: number
    height: number
    url: string
    pageScale: number
  }
}

export interface CropOverlayData {
  pdfData: PdfCropperCoords
  subject: string
  section: string
  que: number
  answerOptions: string
  type: 'mcq' | 'msm'
  marks: {
    cm: number
    pm?: number
    im: number
  }
}

export interface PdfCropperSettings {
  general: {
    cropperMode: 'box' | 'line'
    scale: number
    minCropDimension: number
    selectionThrottleInterval: number
  }
}