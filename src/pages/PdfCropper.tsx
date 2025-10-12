import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Download, RotateCcw, FileText, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import Tesseract from 'tesseract.js'

// Set up PDF.js worker for react-pdf v7
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`

interface CropData {
  x: number
  y: number
  width: number
  height: number
  page: number
}

interface QuestionData {
  id: string
  subject: string
  section: string
  questionNumber: number
  answerOptions: string
  correctMarks: number
  incorrectMarks: number
  cropData: CropData
  imageData?: string
  extractedText?: string
  parsedQuestion?: {
    question: string
    options: string[]
  }
}

export default function PdfCropper() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // State
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingOCR, setIsProcessingOCR] = useState(false)
  
  // Test mode state
  const [isTestMode, setIsTestMode] = useState(false)
  const [currentTestQuestion, setCurrentTestQuestion] = useState(0)
  const [testAnswers, setTestAnswers] = useState<{[key: string]: string}>({})
  const [testSubmitted, setTestSubmitted] = useState(false)
  
  // Cropping state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [currentCrop, setCurrentCrop] = useState<CropData | null>(null)

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || file.type !== 'application/pdf') {
      toast({
        title: "Invalid file",
        description: "Please select a valid PDF file.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      setPdfFile(file)
      
      // Create URL for the file
      const url = URL.createObjectURL(file)
      setPdfUrl(url)
      
      toast({
        title: "PDF loaded successfully",
        description: `Loaded ${file.name}`,
      })
    } catch (error) {
      console.error('Error loading PDF:', error)
      toast({
        title: "Error loading PDF",
        description: "Failed to load the PDF file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle drag and drop for file upload
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      setIsLoading(true)
      try {
        setPdfFile(pdfFile)
        
        // Create URL for the file
        const url = URL.createObjectURL(pdfFile)
        setPdfUrl(url)
        
        toast({
          title: "PDF loaded successfully",
          description: `Loaded ${pdfFile.name}`,
        })
      } catch (error) {
        console.error('Error loading PDF:', error)
        toast({
          title: "Error loading PDF",
          description: "Failed to load the PDF file. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    } else {
      toast({
        title: "Invalid file",
        description: "Please drop a valid PDF file.",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Mouse event handlers for cropping
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pageRef.current) return
    
    const rect = pageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setDragStart({ x, y })
    setIsDragging(true)
    setCurrentCrop({ x, y, width: 0, height: 0, page: currentPage })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !pageRef.current) return
    
    const rect = pageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const width = x - dragStart.x
    const height = y - dragStart.y
    
    setCurrentCrop({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(width),
      height: Math.abs(height),
      page: currentPage
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    
    if (currentCrop && currentCrop.width > 10 && currentCrop.height > 10) {
      // Automatically add the question without requiring metadata
      addQuestion()
    } else {
      setCurrentCrop(null)
    }
  }

  // Extract text using Hugging Face TrOCR (much more accurate than Tesseract)
  const extractWithHuggingFace = async (imageDataUrl: string): Promise<string> => {
    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl)
      const blob = await response.blob()
      
      // Use Hugging Face's free TrOCR model
      const hfResponse = await fetch(
        "https://api-inference.huggingface.co/models/microsoft/trocr-base-printed",
        {
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          body: blob,
        }
      )
      
      if (!hfResponse.ok) {
        throw new Error(`Hugging Face API error: ${hfResponse.status}`)
      }
      
      const result = await hfResponse.json()
      console.log('Hugging Face OCR result:', result)
      
      if (result && result[0] && result[0].generated_text) {
        return result[0].generated_text
      } else {
        throw new Error('No text detected by Hugging Face OCR')
      }
    } catch (error) {
      console.error('Hugging Face OCR failed:', error)
      throw error
    }
  }

  // Fallback to enhanced Tesseract if Hugging Face fails
  const extractWithTesseract = async (canvas: HTMLCanvasElement): Promise<string> => {
    try {
      // Use the enhanced image preprocessing we already have
      const preprocessedCanvas = preprocessImage(canvas)
      const upscaledCanvas = upscaleImage(preprocessedCanvas, 3)
      
      const { data: { text, confidence } } = await Tesseract.recognize(upscaledCanvas, 'eng', {
        logger: m => console.log('Tesseract OCR:', m),
      })
      
      console.log('Tesseract confidence:', confidence)
      return text
    } catch (error) {
      console.error('Tesseract OCR failed:', error)
      throw error
    }
  }
  const preprocessImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Step 1: Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale using luminance formula
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
      
      // Enhance contrast (make darks darker, lights lighter)
      const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)
      
      data[i] = enhanced     // Red
      data[i + 1] = enhanced // Green
      data[i + 2] = enhanced // Blue
      // Alpha stays the same
    }

    // Step 2: Apply threshold (binarization) for better text recognition
    const threshold = 128
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      const binary = avg > threshold ? 255 : 0
      
      data[i] = binary     // Red
      data[i + 1] = binary // Green
      data[i + 2] = binary // Blue
    }

    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0)
    
    return canvas
  }

  // Upscale image for better OCR
  const upscaleImage = (canvas: HTMLCanvasElement, scaleFactor: number = 3): HTMLCanvasElement => {
    const upscaledCanvas = document.createElement('canvas')
    const upscaledCtx = upscaledCanvas.getContext('2d')
    if (!upscaledCtx) return canvas

    // Set new dimensions
    upscaledCanvas.width = canvas.width * scaleFactor
    upscaledCanvas.height = canvas.height * scaleFactor

    // Disable image smoothing for crisp text
    upscaledCtx.imageSmoothingEnabled = false

    // Draw upscaled image
    upscaledCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, upscaledCanvas.width, upscaledCanvas.height)

    return upscaledCanvas
  }

  // Extract text from cropped area using OCR
  const extractTextFromCrop = async (cropData: CropData): Promise<{question: string, options: string[], croppedImageData: string}> => {
    try {
      if (!pageRef.current) {
        throw new Error('Page reference not available')
      }

      // Get the canvas element from the PDF page
      const canvas = pageRef.current.querySelector('canvas')
      if (!canvas) {
        throw new Error('Canvas not found')
      }

      console.log('Canvas found:', canvas.width, 'x', canvas.height)
      console.log('Crop data:', cropData)

      // Create a new canvas for the cropped area
      const croppedCanvas = document.createElement('canvas')
      const ctx = croppedCanvas.getContext('2d')
      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Adjust crop coordinates for the current scale
      const actualX = cropData.x / scale
      const actualY = cropData.y / scale
      const actualWidth = cropData.width / scale
      const actualHeight = cropData.height / scale

      // Set canvas dimensions to match the crop area
      croppedCanvas.width = actualWidth
      croppedCanvas.height = actualHeight

      // Draw the cropped portion onto the new canvas
      ctx.drawImage(
        canvas,
        actualX, actualY, actualWidth, actualHeight,
        0, 0, actualWidth, actualHeight
      )

      console.log('Original cropped canvas created:', croppedCanvas.width, 'x', croppedCanvas.height)

      // Step 1: Preprocess the image for better OCR
      const preprocessedCanvas = preprocessImage(croppedCanvas)
      console.log('Image preprocessed: contrast enhanced, converted to binary')

      // Step 2: Upscale for better OCR accuracy
      const upscaledCanvas = upscaleImage(preprocessedCanvas, 3)
      console.log('Image upscaled:', upscaledCanvas.width, 'x', upscaledCanvas.height)

      // Convert final canvas to data URL for debugging
      const dataURL = upscaledCanvas.toDataURL()
      console.log('Final processed image data URL length:', dataURL.length)

      // Store the cropped image for debugging (use original for display)
      const originalDataURL = croppedCanvas.toDataURL()
      const tempLink = document.createElement('a')
      tempLink.href = originalDataURL
      tempLink.download = `question_${Date.now()}.png`
      console.log('Original cropped image available for download:', tempLink.download)

      // Try Hugging Face TrOCR first (most accurate), then fallback to Tesseract
      console.log('Starting OCR with Hugging Face TrOCR...')
      let text = ''
      let confidence = 0
      
      try {
        // Convert canvas to blob for Hugging Face API
        const blob = await new Promise<Blob>((resolve) => {
          upscaledCanvas.toBlob((blob) => resolve(blob!), 'image/png')
        })
        
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/models/microsoft/trocr-large-printed",
          {
            headers: { "Content-Type": "application/octet-stream" },
            method: "POST",
            body: blob,
          }
        )
        
        if (hfResponse.ok) {
          const result = await hfResponse.json()
          if (result && result[0] && result[0].generated_text) {
            text = result[0].generated_text
            confidence = 95 // HF is very accurate
            console.log('✅ Hugging Face OCR successful:', text)
          } else {
            throw new Error('No text in HF response')
          }
        } else {
          throw new Error(`HF API error: ${hfResponse.status}`)
        }
      } catch (hfError) {
        console.warn('⚠️ Hugging Face failed, falling back to Tesseract:', hfError)
        
        // Fallback to Tesseract with basic config
        const tesseractResult = await Tesseract.recognize(upscaledCanvas, 'eng', {
          logger: m => console.log('Tesseract:', m),
        })
        
        text = tesseractResult.data.text
        confidence = tesseractResult.data.confidence
        console.log('✅ Tesseract fallback completed')
      }

      console.log('OCR completed. Confidence:', confidence)
      console.log('Extracted text:', text)

      // Parse the extracted text to separate question and options
      const lines = text.split('\n').filter(line => line.trim().length > 2) // Filter out very short lines
      console.log('Parsed lines:', lines)
      
      // Try to identify question and options
      let question = 'Question text not detected'
      const options: string[] = []
      
      // More flexible option detection
      const optionPatterns = [
        /^[A-Da-d][\)\.]?\s*(.+)/, // A) text or A. text
        /^\([A-Da-d]\)\s*(.+)/, // (A) text
        /^[A-Da-d]\s+(.+)/, // A text (space separated)
      ]

      let questionLines: string[] = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        let isOption = false
        
        // Check if this line matches any option pattern
        for (const pattern of optionPatterns) {
          const match = line.match(pattern)
          if (match && match[1]) {
            options.push(match[1].trim())
            isOption = true
            console.log('Found option:', match[1].trim())
            break
          }
        }
        
        // If not an option and we haven't found options yet, it's part of the question
        if (!isOption && options.length === 0) {
          questionLines.push(line)
        }
      }

      // Join question lines
      if (questionLines.length > 0) {
        question = questionLines.join(' ').trim()
      }

      console.log('Final question:', question)
      console.log('Final options:', options)

      // If we still don't have good options, try a different approach
      if (options.length === 0) {
        console.log('No options found, trying alternative parsing...')
        
        // Look for any lines that might be options (even without clear markers)
        const potentialOptions = lines.filter(line => {
          const trimmed = line.trim()
          return trimmed.length > 1 && trimmed.length < 200 && 
                 !trimmed.includes('?') && // Probably not part of question
                 trimmed !== question
        })
        
        if (potentialOptions.length > 0) {
          options.push(...potentialOptions.slice(0, 4)) // Take up to 4 options
          console.log('Alternative options found:', options)
        }
      }

        // If still no options, create generic ones but with a clear indicator
        if (options.length === 0) {
          console.log('No options detected, using fallback')
          return {
            question: question || 'Question could not be extracted clearly',
            options: ['[OCR Failed] Option A', '[OCR Failed] Option B', '[OCR Failed] Option C', '[OCR Failed] Option D'],
            croppedImageData: originalDataURL
          }
        }

        // Ensure we have at least 2 options, pad if necessary
        while (options.length < 2) {
          options.push(`[Generated] Option ${String.fromCharCode(65 + options.length)}`)
        }      return { question, options: options.slice(0, 4), croppedImageData: originalDataURL } // Limit to 4 options
    } catch (error) {
      console.error('OCR extraction failed:', error)
      return {
        question: 'Error: Could not extract text',
        options: ['[Error] Option A', '[Error] Option B', '[Error] Option C', '[Error] Option D'],
        croppedImageData: ''
      }
    }
  }

  // Add question with current crop and OCR
  const addQuestion = async () => {
    if (!currentCrop) return

    setIsProcessingOCR(true)
    
    try {
      // Extract text from the cropped area
      const { question, options, croppedImageData } = await extractTextFromCrop(currentCrop)

      const newQuestion: QuestionData = {
        id: `q_${Date.now()}`,
        subject: 'Question',
        section: 'Section',
        questionNumber: questions.length + 1,
        answerOptions: '4',
        correctMarks: 1,
        incorrectMarks: 0,
        cropData: currentCrop,
        parsedQuestion: { question, options },
        imageData: croppedImageData // Store the cropped image
      }

      setQuestions([...questions, newQuestion])
      setCurrentCrop(null)

      toast({
        title: "Question added with OCR",
        description: `Added Question ${newQuestion.questionNumber} - Text extracted successfully`,
      })
    } catch (error) {
      console.error('Failed to add question with OCR:', error)
      
      // Fallback: add question without OCR
      const newQuestion: QuestionData = {
        id: `q_${Date.now()}`,
        subject: 'Question',
        section: 'Section',
        questionNumber: questions.length + 1,
        answerOptions: '4',
        correctMarks: 1,
        incorrectMarks: 0,
        cropData: currentCrop
      }

      setQuestions([...questions, newQuestion])
      setCurrentCrop(null)

      toast({
        title: "Question added",
        description: `Added Question ${newQuestion.questionNumber} - OCR failed, using fallback`,
        variant: "destructive"
      })
    } finally {
      setIsProcessingOCR(false)
    }
  }

  // Remove question
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
    toast({
      title: "Question removed",
      description: "Question has been removed from the list",
    })
  }

  // Export CBT
  const exportCBT = async () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "Please add some questions before exporting.",
        variant: "destructive",
      })
      return
    }

    try {
      const zip = new JSZip()
      
      // Add question data as JSON
      const testData = {
        title: 'CBT Test',
        subject: 'Test',
        questions: questions.map(q => ({
          id: q.id,
          section: q.section,
          questionNumber: q.questionNumber,
          answerOptions: parseInt(q.answerOptions),
          correctMarks: q.correctMarks,
          incorrectMarks: q.incorrectMarks,
          cropData: q.cropData
        }))
      }
      
      zip.file('test_data.json', JSON.stringify(testData, null, 2))
      
      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const fileName = `cbt_test_${new Date().toISOString().split('T')[0]}.zip`
      
      saveAs(zipBlob, fileName)
      
      toast({
        title: "Export successful",
        description: `Exported ${questions.length} questions to ${fileName}`,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: "Export failed",
        description: "Failed to export CBT. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Start test mode
  const startTest = () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "Please add some questions before starting the test.",
        variant: "destructive",
      })
      return
    }

    setIsTestMode(true)
    setCurrentTestQuestion(0)
    setTestAnswers({})
    setTestSubmitted(false)
    
    toast({
      title: "Test started",
      description: `Starting test with ${questions.length} questions`,
    })
  }

  // Handle test answer selection
  const handleAnswerSelect = (questionId: string, answer: string) => {
    setTestAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Submit test
  const submitTest = () => {
    setTestSubmitted(true)
    const answeredQuestions = Object.keys(testAnswers).length
    
    toast({
      title: "Test submitted",
      description: `Answered ${answeredQuestions} out of ${questions.length} questions`,
    })
  }

  // Go back to cropping mode
  const exitTestMode = () => {
    setIsTestMode(false)
    setCurrentTestQuestion(0)
    setTestAnswers({})
    setTestSubmitted(false)
  }

  // PDF document load success
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
    setCurrentPage(1)
    setIsLoading(false)
  }

  // PDF document load error
  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setIsLoading(false)
    toast({
      title: "Error loading PDF",
      description: "Failed to load the PDF file. Please try a different file.",
      variant: "destructive",
    })
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isTestMode ? "CBT Test" : "PDF Cropper"}
          </h1>
          <p className="text-muted-foreground">
            {isTestMode 
              ? `Question ${currentTestQuestion + 1} of ${questions.length}` 
              : "Extract questions from PDF documents"
            }
          </p>
        </div>
        {isTestMode && (
          <Button onClick={exitTestMode} variant="outline">
            Back to Cropping
          </Button>
        )}
      </div>

      {isTestMode ? (
        // Test Mode Interface
        <div className="space-y-6">
          {!testSubmitted ? (
            // Active Test
            <Card>
              <CardHeader>
                <CardTitle>Question {currentTestQuestion + 1}</CardTitle>
                <CardDescription>
                  Select your answer and click Next to continue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Question Text and Debug Info */}
                {questions[currentTestQuestion]?.parsedQuestion && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border">
                      <h3 className="font-medium text-blue-900 mb-2">Question:</h3>
                      <p className="text-blue-800">{questions[currentTestQuestion].parsedQuestion.question}</p>
                    </div>
                    
                    {/* Debug: Show if OCR found real options */}
                    {questions[currentTestQuestion].parsedQuestion.options.some(opt => !opt.includes('[') && !opt.startsWith('Option')) && (
                      <div className="p-2 bg-green-50 rounded border text-sm text-green-700">
                        ✓ OCR successfully extracted options from PDF
                      </div>
                    )}
                    
                    {questions[currentTestQuestion].parsedQuestion.options.some(opt => opt.includes('[')) && (
                      <div className="p-2 bg-red-50 rounded border text-sm text-red-700">
                        ⚠ OCR could not extract options clearly - check console for details
                        {questions[currentTestQuestion].imageData && (
                          <div className="mt-2">
                            <p className="text-xs mb-1">Cropped image sent to OCR:</p>
                            <img 
                              src={questions[currentTestQuestion].imageData} 
                              alt="Cropped question area" 
                              className="border rounded max-w-full h-auto max-h-32"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Question Image */}
                <div className="border rounded-lg overflow-hidden bg-gray-50 min-h-[300px] relative">
                  {pdfFile && pdfUrl && (
                    <Document
                      file={pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={<div>Loading PDF...</div>}
                    >
                      <div className="relative">
                        <Page
                          pageNumber={questions[currentTestQuestion]?.cropData.page || 1}
                          scale={scale * 0.8}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                        
                        {/* Highlight the current question area */}
                        {questions[currentTestQuestion] && (
                          <div
                            className="absolute border-4 border-red-500 bg-red-200 bg-opacity-10 pointer-events-none"
                            style={{
                              left: questions[currentTestQuestion].cropData.x * 0.8,
                              top: questions[currentTestQuestion].cropData.y * 0.8,
                              width: questions[currentTestQuestion].cropData.width * 0.8,
                              height: questions[currentTestQuestion].cropData.height * 0.8,
                            }}
                          />
                        )}
                      </div>
                    </Document>
                  )}
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Select your answer:</Label>
                  <div className="grid gap-2">
                    {questions[currentTestQuestion]?.parsedQuestion?.options ? (
                      // Use extracted options from OCR
                      questions[currentTestQuestion].parsedQuestion.options.map((option, index) => {
                        const optionLetter = String.fromCharCode(65 + index) // A, B, C, D
                        return (
                          <Button
                            key={optionLetter}
                            variant={testAnswers[questions[currentTestQuestion]?.id] === optionLetter ? "default" : "outline"}
                            className="justify-start h-auto min-h-12 text-left p-4"
                            onClick={() => handleAnswerSelect(questions[currentTestQuestion]?.id, optionLetter)}
                          >
                            <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-3 text-sm font-bold flex-shrink-0">
                              {optionLetter}
                            </span>
                            <span className="text-sm">{option}</span>
                          </Button>
                        )
                      })
                    ) : (
                      // Fallback to generic options
                      ['A', 'B', 'C', 'D'].slice(0, parseInt(questions[currentTestQuestion]?.answerOptions || '4')).map((option) => (
                        <Button
                          key={option}
                          variant={testAnswers[questions[currentTestQuestion]?.id] === option ? "default" : "outline"}
                          className="justify-start h-12 text-left"
                          onClick={() => handleAnswerSelect(questions[currentTestQuestion]?.id, option)}
                        >
                          <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center mr-3 text-sm font-bold">
                            {option}
                          </span>
                          Option {option}
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentTestQuestion(Math.max(0, currentTestQuestion - 1))}
                    disabled={currentTestQuestion === 0}
                  >
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    {Object.keys(testAnswers).length} of {questions.length} answered
                  </span>
                  
                  {currentTestQuestion < questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentTestQuestion(currentTestQuestion + 1)}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={submitTest}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Submit Test
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            // Test Results
            <Card>
              <CardHeader>
                <CardTitle>Test Completed!</CardTitle>
                <CardDescription>
                  Here are your results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                    <div className="text-sm text-gray-600">Total Questions</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{Object.keys(testAnswers).length}</div>
                    <div className="text-sm text-gray-600">Answered</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{questions.length - Object.keys(testAnswers).length}</div>
                    <div className="text-sm text-gray-600">Unanswered</div>
                  </div>
                </div>

                {/* Answer Summary */}
                <div className="space-y-2">
                  <h4 className="font-medium">Your Answers:</h4>
                  <div className="grid gap-2">
                    {questions.map((question, index) => (
                      <div key={question.id} className="flex justify-between items-center p-2 border rounded">
                        <span>Question {index + 1}</span>
                        <span className={`font-bold ${testAnswers[question.id] ? 'text-green-600' : 'text-red-600'}`}>
                          {testAnswers[question.id] || 'Not Answered'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setTestSubmitted(false)}>
                    Retake Test
                  </Button>
                  <Button onClick={exitTestMode} variant="outline">
                    Back to Cropping
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // Cropping Mode Interface (existing code)
        <div className="grid gap-6 lg:grid-cols-1">
        {/* PDF Viewer */}
        <Card>
          <CardHeader>
            <CardTitle>PDF Cropper</CardTitle>
            <CardDescription>
              Upload a PDF and click & drag to select question areas. Questions will be added automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label>PDF File</Label>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-sm text-gray-600">
                  {pdfFile ? pdfFile.name : 'Click or drag PDF file here'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Export Button */}
            {questions.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {questions.length} question{questions.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button onClick={startTest} variant="default">
                    Take Test ({questions.length})
                  </Button>
                  <Button onClick={exportCBT} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export CBT
                  </Button>
                </div>
              </div>
            )}

            {/* PDF Viewer Area */}
            <div className="border rounded-lg overflow-hidden bg-gray-50 min-h-[600px] relative">
              {pdfFile && pdfUrl ? (
                <div className="relative w-full h-full">
                  {(isLoading || isProcessingOCR) && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p>{isProcessingOCR ? 'Extracting text with OCR...' : 'Loading PDF...'}</p>
                      </div>
                    </div>
                  )}
                  
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<div>Loading PDF...</div>}
                  >
                    <div 
                      ref={pageRef}
                      className="relative cursor-crosshair"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      
                      {/* Current crop selection */}
                      {currentCrop && (
                        <div
                          className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none"
                          style={{
                            left: currentCrop.x,
                            top: currentCrop.y,
                            width: currentCrop.width,
                            height: currentCrop.height,
                          }}
                        />
                      )}

                      {/* Existing question overlays */}
                      {questions
                        .filter(q => q.cropData.page === currentPage)
                        .map((question) => (
                          <div
                            key={question.id}
                            className="absolute border-2 border-green-500 bg-green-200 bg-opacity-20 pointer-events-none"
                            style={{
                              left: question.cropData.x,
                              top: question.cropData.y,
                              width: question.cropData.width,
                              height: question.cropData.height,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-1 rounded">
                              Q{question.questionNumber}
                            </div>
                          </div>
                        ))}
                    </div>
                  </Document>
                  
                  {/* Controls */}
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-white rounded-lg shadow-lg p-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <span className="text-sm px-2">
                      {currentPage} / {totalPages}
                    </span>
                    
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <div className="border-l pl-2 ml-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      
                      <span className="text-sm px-2">
                        {Math.round(scale * 100)}%
                      </span>
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setScale(Math.min(2.0, scale + 0.1))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4" />
                    <p>No PDF loaded</p>
                    <p className="text-sm">Upload a PDF file to get started</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Questions List */}
        {questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Questions ({questions.length})</CardTitle>
              <CardDescription>Manage your extracted questions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium">Q{question.questionNumber}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {question.answerOptions} options • Page {question.cropData.page}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeQuestion(question.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      )}
    </div>
  )
}