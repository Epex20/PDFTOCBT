/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Comlink from 'comlink'

interface PdfData {
  page: number
  x: number
  y: number
  w: number
  h: number
}

interface PageImgData {
  [pageNum: number]: {
    width: number
    height: number
    url: string
    pageScale: number
  }
}

interface TestImageBlobs {
  [section: string]: {
    [question: string]: Blob[]
  }
}

export class PdfProcessor {
  private mupdf: any = null
  private doc: any = null

  async loadMuPdf() {
    if (!this.mupdf) {
      try {
        // Try to load MuPDF (in a real implementation, you'd need to include the MuPDF library)
        // For now, we'll use a placeholder that throws an error with instructions
        throw new Error('MuPDF library not loaded. Please include MuPDF WebAssembly files in your public directory.')
      } catch (err) {
        console.error('Error loading MuPDF:', err)
        throw err
      }
    }
  }

  async loadPdf(
    pdfFile: Uint8Array | ArrayBuffer,
    getPageCount: boolean = false,
  ) {
    await this.loadMuPdf()
    
    // Placeholder implementation - in real app, this would use MuPDF
    console.log('Loading PDF with', pdfFile.byteLength, 'bytes')
    
    if (getPageCount) {
      // Return mock page count for now
      return 10
    }
  }

  async getAllPagesDimensionsData(): Promise<PageImgData> {
    // Mock implementation
    const pageImgData: PageImgData = {}
    
    for (let i = 1; i <= 10; i++) {
      pageImgData[i] = {
        width: 595, // A4 width in points
        height: 842, // A4 height in points
        url: '',
        pageScale: 1,
      }
    }

    return pageImgData
  }

  async getPageImage(
    pageNum: number,
    scale: number,
    transparent: boolean = false,
  ): Promise<Blob> {
    // Mock implementation - return a placeholder image blob
    const canvas = new OffscreenCanvas(595 * scale, 842 * scale)
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      ctx.fillStyle = transparent ? 'transparent' : 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = 'black'
      ctx.font = '24px Arial'
      ctx.fillText(`Page ${pageNum}`, 50, 50)
    }

    return await canvas.convertToBlob({ type: 'image/png' })
  }

  async generateQuestionImages(
    questionsData: any,
    scale: number,
    transparent: boolean = false,
  ): Promise<TestImageBlobs> {
    const imageBlobs: TestImageBlobs = {}
    
    // Mock implementation
    for (const [section, questions] of Object.entries(questionsData as any)) {
      imageBlobs[section] = {}
      for (const [questionId] of Object.entries(questions as any)) {
        const mockBlob = await this.getPageImage(1, scale, transparent)
        imageBlobs[section][questionId] = [mockBlob]
      }
    }

    return imageBlobs
  }

  private async getCroppedImg(pageData: any, pdfData: PdfData): Promise<Blob> {
    // Mock implementation - return cropped image
    const { w, h } = pdfData
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, w, h)
      
      ctx.fillStyle = 'black'
      ctx.font = '16px Arial'
      ctx.fillText('Cropped Question', 10, 30)
    }

    return await canvas.convertToBlob({ type: 'image/png' })
  }

  close() {
    this.doc?.destroy()
    this.doc = null
    this.mupdf = null
    self.close()
  }
}

Comlink.expose(new PdfProcessor())