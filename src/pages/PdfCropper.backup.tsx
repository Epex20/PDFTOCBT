import { useState, useRef, useCallback, useEffect } from 'react'
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

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

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
  marks: {
    correct: number
    incorrect: number
  }
  cropData: CropData
}

const PdfCropper = () => {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cropAreaRef = useRef<HTMLDivElement>(null)
  
  // State
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfDocument, setPdfDocument] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Current question being created
  const [currentQuestion, setCurrentQuestion] = useState({
    subject: '',
    section: '',
    questionNumber: 1,
    answerOptions: '4',
    correctMarks: 1,
    incorrectMarks: 0
  })
  
  // Cropping state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [currentCrop, setCurrentCrop] = useState<CropData | null>(null)

  // Initialize PDF.js
  useEffect(() => {
    const initializePDFJS = async () => {
      if (pdfjsLib) return // Already initialized
      
      try {
        const pdfjs = await import('pdfjs-dist')
        
        // Use local worker file (simpler approach)
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        
        pdfjsLib = pdfjs
        
        toast({
          title: "PDF viewer ready",
          description: "You can now upload PDF files.",
        })
      } catch (error) {
        console.error('Failed to initialize PDF.js:', error)
        setError('Failed to initialize PDF viewer')
        toast({
          title: "PDF viewer error",
          description: "Failed to load PDF viewer. Please refresh the page.",
          variant: "destructive",
        })
      }
    }

    // Download the PDF.js worker file if it doesn't exist
    const downloadWorker = async () => {
      try {
        const response = await fetch('/pdf.worker.min.js')
        if (!response.ok) {
          // Download the worker from CDN
          const workerResponse = await fetch('https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.js')
          const workerCode = await workerResponse.text()
          
          // For now, we'll just use the CDN directly
          console.log('Worker download would happen here')
        }
      } catch (error) {
        console.warn('Could not setup local worker, will use CDN')
      }
    }

    downloadWorker().then(() => initializePDFJS())
  }, [])

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

    if (!pdfjsLib) {
      toast({
        title: "PDF.js not loaded",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      setPdfFile(file)
      
      // Load PDF with PDF.js
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        // Add some options to help with loading
        cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
        cMapPacked: true,
      })
      
      const pdf = await loadingTask.promise
      
      setPdfDocument(pdf)
      setTotalPages(pdf.numPages)
      setCurrentPage(1)
      
      // Render first page
      await renderPage(1, pdf)
      
      toast({
        title: "PDF loaded successfully",
        description: `Loaded PDF: ${file.name} (${pdf.numPages} pages)`,
      })
    } catch (error) {
      console.error('Error loading PDF:', error)
      toast({
        title: "Error loading PDF",
        description: `Failed to load the PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Render PDF page
  const renderPage = async (pageNum: number, pdf?: any) => {
    if (!canvasRef.current) return
    
    const document = pdf || pdfDocument
    if (!document) return

    try {
      const page = await document.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDocument && currentPage) {
      renderPage(currentPage)
    }
  }, [currentPage, scale, pdfDocument])

  // Handle drag and drop for file upload
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      if (!pdfjsLib) {
        toast({
          title: "PDF.js not loaded",
          description: "Please wait a moment and try again.",
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      try {
        setPdfFile(pdfFile)
        
        // Load PDF with PDF.js
        const arrayBuffer = await pdfFile.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        })
        
        const pdf = await loadingTask.promise
        
        setPdfDocument(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
        
        // Render first page
        await renderPage(1, pdf)
        
        toast({
          title: "PDF loaded successfully",
          description: `Loaded PDF: ${pdfFile.name} (${pdf.numPages} pages)`,
        })
      } catch (error) {
        console.error('Error loading PDF:', error)
        toast({
          title: "Error loading PDF",
          description: `Failed to load the PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    } else {
      toast({
        title: "Invalid file",
        description: "Please drop a PDF file.",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Handle cropping
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cropAreaRef.current) return
    
    const rect = cropAreaRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setDragStart({ x, y })
    setIsDragging(true)
    setCurrentCrop({ x, y, width: 0, height: 0, page: currentPage })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cropAreaRef.current) return
    
    const rect = cropAreaRef.current.getBoundingClientRect()
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
  }

  // Save current question
  const saveQuestion = () => {
    if (!currentCrop || !currentQuestion.subject || !currentQuestion.section) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields and create a crop area.",
        variant: "destructive",
      })
      return
    }

    if (currentCrop.width < 10 || currentCrop.height < 10) {
      toast({
        title: "Selection too small",
        description: "Please make a larger selection.",
        variant: "destructive",
      })
      return
    }

    const newQuestion: QuestionData = {
      id: `${Date.now()}`,
      subject: currentQuestion.subject,
      section: currentQuestion.section,
      questionNumber: currentQuestion.questionNumber,
      answerOptions: currentQuestion.answerOptions,
      marks: {
        correct: currentQuestion.correctMarks,
        incorrect: currentQuestion.incorrectMarks
      },
      cropData: { ...currentCrop }
    }

    setQuestions(prev => [...prev, newQuestion])
    setCurrentCrop(null)
    
    // Increment question number for next question
    setCurrentQuestion(prev => ({
      ...prev,
      questionNumber: prev.questionNumber + 1
    }))

    toast({
      title: "Question saved",
      description: `Question ${newQuestion.questionNumber} saved successfully.`,
    })
  }

  // Generate output
  const generateOutput = async () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "Please create at least one question.",
        variant: "destructive",
      })
      return
    }

    if (!pdfFile) {
      toast({
        title: "No PDF",
        description: "Please upload a PDF file first.",
        variant: "destructive",
      })
      return
    }

    try {
      // Create JSON data
      const outputData = {
        testConfig: {
          pdfFileHash: Date.now().toString(),
          totalQuestions: questions.length
        },
        questions: questions.map(q => ({
          subject: q.subject,
          section: q.section,
          questionNumber: q.questionNumber,
          answerOptions: q.answerOptions,
          marks: q.marks,
          cropArea: q.cropData
        })),
        appVersion: '1.0.0',
        generatedBy: 'pdfCropper',
        createdAt: new Date().toISOString()
      }

      // Create ZIP file
      const zip = new JSZip()
      zip.file('test-data.json', JSON.stringify(outputData, null, 2))
      zip.file('questions.pdf', pdfFile)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `cbt-test-${Date.now()}.zip`)

      toast({
        title: "Export successful",
        description: `Exported ${questions.length} questions to ZIP file.`,
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to create export file.",
        variant: "destructive",
      })
    }
  }

  // Clear all data
  const clearAll = () => {
    setQuestions([])
    setCurrentCrop(null)
    setCurrentQuestion({
      subject: '',
      section: '',
      questionNumber: 1,
      answerOptions: '4',
      correctMarks: 1,
      incorrectMarks: 0
    })
    toast({
      title: "Cleared",
      description: "All questions cleared.",
    })
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">PDF Question Cropper</h1>
        <Button onClick={() => window.history.back()} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Question Setup</CardTitle>
            <CardDescription>
              Upload PDF and configure question details
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
                  {!pdfjsLib && (
                    <p className="text-xs text-orange-600 mt-2">
                      Loading PDF viewer...
                    </p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>            {/* Page Navigation */}
            {pdfFile && (
              <div className="space-y-2">
                <Label>Page Navigation</Label>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1)
                      setCurrentPage(newPage)
                    }}
                    disabled={currentPage <= 1 || isLoading}
                    size="sm"
                  >
                    ←
                  </Button>
                  <Input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                      }
                    }}
                    min={1}
                    max={totalPages}
                    className="text-center w-20"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                  <Button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1)
                      setCurrentPage(newPage)
                    }}
                    disabled={currentPage >= totalPages || isLoading}
                    size="sm"
                  >
                    →
                  </Button>
                </div>
              </div>
            )}

            {/* Scale */}
            <div className="space-y-2">
              <Label>Zoom: {scale.toFixed(1)}x</Label>
              <Input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
              />
            </div>

            {/* Question Details */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Question Details</h3>
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={currentQuestion.subject}
                  onChange={(e) => setCurrentQuestion(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="space-y-2">
                <Label>Section</Label>
                <Input
                  value={currentQuestion.section}
                  onChange={(e) => setCurrentQuestion(prev => ({ ...prev, section: e.target.value }))}
                  placeholder="e.g., Algebra"
                />
              </div>

              <div className="space-y-2">
                <Label>Question Number</Label>
                <Input
                  type="number"
                  value={currentQuestion.questionNumber}
                  onChange={(e) => setCurrentQuestion(prev => ({ ...prev, questionNumber: parseInt(e.target.value) || 1 }))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label>Answer Options</Label>
                <Select 
                  value={currentQuestion.answerOptions} 
                  onValueChange={(value) => setCurrentQuestion(prev => ({ ...prev, answerOptions: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Options (A, B)</SelectItem>
                    <SelectItem value="3">3 Options (A, B, C)</SelectItem>
                    <SelectItem value="4">4 Options (A, B, C, D)</SelectItem>
                    <SelectItem value="5">5 Options (A, B, C, D, E)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Correct Marks</Label>
                  <Input
                    type="number"
                    value={currentQuestion.correctMarks}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, correctMarks: parseFloat(e.target.value) || 0 }))}
                    step={0.1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Penalty</Label>
                  <Input
                    type="number"
                    value={currentQuestion.incorrectMarks}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, incorrectMarks: parseFloat(e.target.value) || 0 }))}
                    step={0.1}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveQuestion} className="flex-1">
                  Save Question
                </Button>
                <Button onClick={clearAll} variant="outline" size="icon">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Saved Questions: {questions.length}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF Viewer and Cropping Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>PDF Viewer</CardTitle>
            <CardDescription>
              Click and drag to select question areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-gray-50 min-h-[600px] relative">
              {pdfFile ? (
                <div className="relative w-full h-full">
                  {isLoading && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p>Loading PDF...</p>
                      </div>
                    </div>
                  )}
                  
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto block mx-auto"
                    style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                  />
                  
                  {/* Cropping overlay */}
                  <div 
                    ref={cropAreaRef}
                    className="absolute inset-0 cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
                  >
                    {/* Current crop selection */}
                    {currentCrop && (
                      <div
                        className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20"
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
                          className="absolute border-2 border-green-500 bg-green-200 bg-opacity-20"
                          style={{
                            left: question.cropData.x,
                            top: question.cropData.y,
                            width: question.cropData.width,
                            height: question.cropData.height,
                          }}
                        >
                          <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-1 rounded">
                            {question.section} Q{question.questionNumber}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                  <div className="text-center">
                    <Upload className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Upload a PDF file to start cropping questions</p>
                    <p className="text-sm">Drag and drop a PDF file or click the upload area</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Questions
          </CardTitle>
          <CardDescription>
            Download your cropped questions as a ZIP package
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={generateOutput} 
            disabled={questions.length === 0}
            className="w-full"
          >
            Export {questions.length} Questions
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default PdfCropper