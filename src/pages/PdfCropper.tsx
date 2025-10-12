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
  questionNumber: number
  cropData: CropData
  imageData: string // Base64 image data of the cropped question
  correctAnswer?: 'A' | 'B' | 'C' | 'D' // For answer key (optional)
}

export default function PdfCropper() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  const [showResults, setShowResults] = useState(false)
  const [currentTestQuestion, setCurrentTestQuestion] = useState(0)
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({})
  const [testStartTime, setTestStartTime] = useState<Date | null>(null)
  const [testEndTime, setTestEndTime] = useState<Date | null>(null)
  
  // Cropping state
  const [isDragging, setIsDragging] = useState(false)
  const [currentCrop, setCurrentCrop] = useState<CropData | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)

  // File handling
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
      const url = URL.createObjectURL(file)
      setPdfUrl(url)
      setCurrentPage(1)
      setQuestions([])
      
      toast({
        title: "PDF loaded",
        description: "You can now crop questions from the PDF",
      })
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a PDF file",
        variant: "destructive"
      })
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages)
    setIsLoading(false)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setIsLoading(false)
    toast({
      title: "PDF Load Error",
      description: "Failed to load the PDF file",
      variant: "destructive"
    })
  }

  // Get precise coordinates relative to the PDF canvas
  const getCanvasCoordinates = (event: React.MouseEvent) => {
    if (!pageRef.current) return { x: 0, y: 0 }
    
    const canvas = pageRef.current.querySelector('canvas')
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    console.log('Mouse coordinates relative to canvas:', { x, y })
    console.log('Canvas dimensions:', { width: canvas.width, height: canvas.height })
    console.log('Canvas display size:', { width: rect.width, height: rect.height })
    
    return { x, y }
  }

  // Mouse event handlers for cropping
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    const coords = getCanvasCoordinates(event)
    setStartPoint(coords)
    setIsDragging(true)
    setCurrentCrop({
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0,
      page: currentPage
    })
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || !startPoint) return
    
    const coords = getCanvasCoordinates(event)
    const width = coords.x - startPoint.x
    const height = coords.y - startPoint.y
    
    setCurrentCrop({
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(width),
      height: Math.abs(height),
      page: currentPage
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    
    if (currentCrop && currentCrop.width > 10 && currentCrop.height > 10) {
      // Automatically add the question
      addQuestion()
    } else {
      setCurrentCrop(null)
    }
  }

  // Precise image cropping function
  const cropImageOnly = async (cropData: CropData): Promise<string> => {
    if (!pageRef.current) {
      throw new Error('Page reference not available')
    }

    const canvas = pageRef.current.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) {
      throw new Error('Canvas not found')
    }

    console.log('=== CROPPING DEBUG ===')
    console.log('Canvas actual size:', canvas.width, 'x', canvas.height)
    console.log('Canvas display size:', canvas.offsetWidth, 'x', canvas.offsetHeight)
    console.log('Crop data from UI:', cropData)
    
    // Calculate the scale factor between display and actual canvas
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    
    console.log('Scale factors:', { scaleX, scaleY })
    
    // Convert display coordinates to actual canvas coordinates
    const actualX = cropData.x * scaleX
    const actualY = cropData.y * scaleY
    const actualWidth = cropData.width * scaleX
    const actualHeight = cropData.height * scaleY
    
    console.log('Actual crop coordinates:', { actualX, actualY, actualWidth, actualHeight })

    // Create a new canvas for the cropped area
    const croppedCanvas = document.createElement('canvas')
    const ctx = croppedCanvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not get canvas context')
    }

    // Set dimensions to match the crop area
    croppedCanvas.width = actualWidth
    croppedCanvas.height = actualHeight

    // Extract the cropped portion
    ctx.drawImage(
      canvas,
      actualX, actualY, actualWidth, actualHeight,  // Source coordinates
      0, 0, actualWidth, actualHeight               // Destination coordinates
    )

    // Convert to high-quality data URL
    const imageData = croppedCanvas.toDataURL('image/png', 1.0)
    console.log('✅ Cropped image created, size:', imageData.length, 'bytes')
    console.log('Cropped canvas size:', croppedCanvas.width, 'x', croppedCanvas.height)
    
    return imageData
  }

  // Add question with cropped image
  const addQuestion = async () => {
    if (!currentCrop) return

    setIsProcessingOCR(true)
    
    try {
      const croppedImageData = await cropImageOnly(currentCrop)

      const newQuestion: QuestionData = {
        id: `q_${Date.now()}`,
        questionNumber: questions.length + 1,
        cropData: currentCrop,
        imageData: croppedImageData
      }

      setQuestions([...questions, newQuestion])
      setCurrentCrop(null)

      toast({
        title: "Question added",
        description: `Added Question ${newQuestion.questionNumber} - Image saved successfully`,
      })
      
      console.log('✅ Question added:', newQuestion.id, 'Image size:', croppedImageData.length)
      
    } catch (error) {
      console.error('❌ Failed to add question:', error)
      
      toast({
        title: "Error",
        description: "Failed to crop question image. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsProcessingOCR(false)
    }
  }

  // Navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      setCurrentCrop(null)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
      setCurrentCrop(null)
    }
  }

  const adjustScale = (delta: number) => {
    setScale(Math.max(0.5, Math.min(3.0, scale + delta)))
  }

  // Remove question
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
    toast({
      title: "Question removed",
      description: "Question has been deleted",
    })
  }

  // Test mode functions
  const startTest = () => {
    if (questions.length === 0) {
      toast({
        title: "No questions",
        description: "Please add some questions before starting the test",
        variant: "destructive"
      })
      return
    }
    
    setIsTestMode(true)
    setShowResults(false)
    setCurrentTestQuestion(0)
    setTestAnswers({})
    setTestStartTime(new Date())
    setTestEndTime(null)
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setTestAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const nextQuestion = () => {
    if (currentTestQuestion < questions.length - 1) {
      setCurrentTestQuestion(currentTestQuestion + 1)
    }
  }

  const previousQuestion = () => {
    if (currentTestQuestion > 0) {
      setCurrentTestQuestion(currentTestQuestion - 1)
    }
  }

  const finishTest = () => {
    setTestEndTime(new Date())
    setIsTestMode(false)
    setShowResults(true)
    
    toast({
      title: "Test completed",
      description: `You answered ${Object.keys(testAnswers).length} out of ${questions.length} questions`,
    })
  }

  const backToMain = () => {
    setShowResults(false)
    setIsTestMode(false)
    setTestAnswers({})
    setCurrentTestQuestion(0)
  }

  const retakeTest = () => {
    setShowResults(false)
    startTest()
  }

  // Export functions
  const exportAsZip = async () => {
    if (questions.length === 0) {
      toast({
        title: "No questions to export",
        description: "Please add some questions first",
        variant: "destructive"
      })
      return
    }

    try {
      const zip = new JSZip()
      
      // Add question data as JSON
      const testData = {
        title: 'My Questions',
        questions: questions.map(q => ({
          id: q.id,
          questionNumber: q.questionNumber,
          imageData: q.imageData,
          cropData: q.cropData,
          correctAnswer: q.correctAnswer || null
        }))
      }
      
      zip.file('test_data.json', JSON.stringify(testData, null, 2))
      
      // Add individual question images
      questions.forEach((question, index) => {
        if (question.imageData) {
          // Convert base64 to binary
          const base64Data = question.imageData.split(',')[1]
          zip.file(`question_${index + 1}.png`, base64Data, { base64: true })
        }
      })
      
      // Generate and download the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, 'cbt_questions.zip')
      
      toast({
        title: "Export successful",
        description: `Exported ${questions.length} questions as ZIP file`,
      })
    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: "Export failed",
        description: "Failed to create ZIP file",
        variant: "destructive"
      })
    }
  }

  // Helper function to calculate test duration
  const getTestDuration = () => {
    if (!testStartTime || !testEndTime) return 'Unknown'
    const diffMs = testEndTime.getTime() - testStartTime.getTime()
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  // Results page
  if (showResults) {
    const totalQuestions = questions.length
    const answeredCount = Object.keys(testAnswers).length
    const unansweredCount = totalQuestions - answeredCount

    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">📊 Test Results</CardTitle>
                <CardDescription>
                  Review your answers and performance
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={retakeTest}>
                  🔄 Retake Test
                </Button>
                <Button onClick={backToMain}>
                  🏠 Back to Main
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Test Summary */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalQuestions}</div>
                  <div className="text-sm text-gray-600">Total Questions</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{answeredCount}</div>
                  <div className="text-sm text-gray-600">Answered</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{unansweredCount}</div>
                  <div className="text-sm text-gray-600">Unanswered</div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{getTestDuration()}</div>
                  <div className="text-sm text-gray-600">Duration</div>
                </div>
              </Card>
            </div>

            {/* Question by Question Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">📝 Question by Question Review</h3>
              <div className="grid gap-4">
                {questions.map((question, index) => {
                  const userAnswer = testAnswers[question.id]
                  const isAnswered = !!userAnswer
                  
                  return (
                    <Card key={question.id} className="p-4 border-gray-200 bg-white">
                      <div className="grid md:grid-cols-3 gap-4 items-center">
                        {/* Question Image */}
                        <div className="space-y-2">
                          <div className="font-medium">Question {question.questionNumber}</div>
                          {question.imageData && (
                            <div className="border rounded overflow-hidden bg-white">
                              <img 
                                src={question.imageData} 
                                alt={`Question ${question.questionNumber}`}
                                className="w-full h-32 object-contain"
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Answer Status */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Your Answer:</div>
                          {isAnswered ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-500 text-blue-700 font-bold">
                                {userAnswer}
                              </span>
                              <span className="text-green-600 font-medium">Option {userAnswer}</span>
                            </div>
                          ) : (
                            <div className="text-red-600 font-medium">❌ Not Answered</div>
                          )}
                        </div>
                        
                        {/* Status Badge */}
                        <div className="text-right">
                          {isAnswered ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              ✅ Answered
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                              ❌ Skipped
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 pt-6 border-t">
              <Button onClick={retakeTest} className="bg-blue-600 hover:bg-blue-700">
                🔄 Take Test Again
              </Button>
              <Button variant="outline" onClick={backToMain}>
                🏠 Back to Question Editor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isTestMode) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Question {currentTestQuestion + 1} of {questions.length}</CardTitle>
                <CardDescription>
                  Select your answer and click Next to continue
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setIsTestMode(false)}>
                Exit Test
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question Image */}
            <div className="border rounded-lg bg-gray-50 w-full h-[85vh] flex items-center justify-center p-2">
              {questions[currentTestQuestion]?.imageData ? (
                <img 
                  src={questions[currentTestQuestion].imageData} 
                  alt={`Question ${questions[currentTestQuestion].questionNumber}`}
                  className="max-w-full max-h-full object-contain"
                  style={{ 
                    minWidth: '80%',
                    minHeight: '80%'
                  }}
                />
              ) : (
                <div className="text-gray-500 text-center">
                  <p>Question image not available</p>
                </div>
              )}
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Select your answer:</Label>
              <div className="grid gap-2">
                {['A', 'B', 'C', 'D'].map((option) => (
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
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={previousQuestion}
                disabled={currentTestQuestion === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <span className="text-sm text-gray-500">
                Question {currentTestQuestion + 1} of {questions.length}
              </span>
              
              {currentTestQuestion < questions.length - 1 ? (
                <Button onClick={nextQuestion}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={finishTest} className="bg-green-600 hover:bg-green-700">
                  Finish Test
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">PDF to CBT Converter</h1>
        <p className="text-gray-600">Upload a PDF and crop question areas to create CBT tests</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Panel - PDF Viewer */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                PDF Viewer & Cropper
              </CardTitle>
              <CardDescription>
                Upload a PDF and draw rectangles around questions to crop them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="pdf-upload">Upload PDF File</Label>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
              </div>

              {/* PDF Controls */}
              {pdfFile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={goToPreviousPage}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={goToNextPage}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustScale(-0.2)}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{Math.round(scale * 100)}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustScale(0.2)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* PDF Display Area */}
              <div className="border rounded-lg overflow-hidden bg-gray-50 min-h-[600px] relative">
                {pdfFile && pdfUrl ? (
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={<div>Loading PDF...</div>}
                  >
                    <div 
                      className="relative cursor-crosshair"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      ref={pageRef}
                    >
                      <Page
                        pageNumber={currentPage}
                        scale={scale}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                      
                      {/* Current crop overlay */}
                      {currentCrop && (
                        <div
                          className="absolute border-2 border-red-500 bg-red-200 bg-opacity-20 pointer-events-none"
                          style={{
                            left: currentCrop.x,
                            top: currentCrop.y,
                            width: currentCrop.width,
                            height: currentCrop.height,
                          }}
                        />
                      )}
                      
                      {/* Show existing question crops */}
                      {questions
                        .filter(q => q.cropData.page === currentPage)
                        .map((question, index) => (
                          <div
                            key={question.id}
                            className="absolute border-2 border-green-500 bg-green-200 bg-opacity-10 pointer-events-none"
                            style={{
                              left: question.cropData.x,
                              top: question.cropData.y,
                              width: question.cropData.width,
                              height: question.cropData.height,
                            }}
                          >
                            <span className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-1 rounded">
                              Q{question.questionNumber}
                            </span>
                          </div>
                        ))}
                    </div>
                  </Document>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-gray-500">
                    <div className="text-center">
                      <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Upload a PDF file to get started</p>
                    </div>
                  </div>
                )}
                
                {isProcessingOCR && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg">
                      <p>Processing question...</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Questions List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Questions ({questions.length})</CardTitle>
              <CardDescription>
                Questions cropped from the PDF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questions.map((question) => (
                  <div key={question.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <span className="font-medium">Q{question.questionNumber}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        4 options • Page {question.cropData.page}
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
                
                {questions.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No questions added yet. Draw rectangles on the PDF to crop questions.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={startTest}
                className="w-full"
                disabled={questions.length === 0}
              >
                Start Test Preview
              </Button>
              
              <Button
                variant="outline"
                onClick={exportAsZip}
                className="w-full"
                disabled={questions.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export as ZIP
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}