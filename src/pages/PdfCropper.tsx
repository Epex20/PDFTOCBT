import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Upload, Download, RotateCcw, FileText, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sparkles, Save, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { Document, Page, pdfjs } from 'react-pdf'
import { supabase } from '@/integrations/supabase/client'
import { Progress } from '@/components/ui/progress'
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
  const navigate = useNavigate()
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
  const [visitedTestQuestions, setVisitedTestQuestions] = useState<Set<number>>(new Set([0]))
  const [testStartTime, setTestStartTime] = useState<Date | null>(null)
  const [testEndTime, setTestEndTime] = useState<Date | null>(null)
  
  // Cropping state
  const [isDragging, setIsDragging] = useState(false)
  const [currentCrop, setCurrentCrop] = useState<CropData | null>(null)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [smartCropping, setSmartCropping] = useState(true) // Enable smart cropping by default
  
  // User and test saving state
  const [user, setUser] = useState<any>(null)
  const [testTitle, setTestTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Check for authenticated user on component mount
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        console.log('Auth check result:', { user, error })
        if (error) {
          console.error('Auth error:', error)
        }
        setUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
      }
    }
    getUser()

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  // Function to detect content boundaries and trim whitespace
  const detectContentBounds = (canvas: HTMLCanvasElement): { x: number, y: number, width: number, height: number } => {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('❌ No canvas context available')
      return { x: 0, y: 0, width: canvas.width, height: canvas.height }
    }

    console.log('🔍 Starting content detection on canvas:', canvas.width, 'x', canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Function to check if a pixel is considered "content" (not white/light background)
    const isContentPixel = (r: number, g: number, b: number, a: number): boolean => {
      // Consider pixel as content if it's not white/very light gray
      const brightness = (r + g + b) / 3
      const isOpaque = a > 200 // Mostly opaque
      const isNotWhite = brightness < 250 // More lenient threshold for better detection
      return isOpaque && isNotWhite
    }

    // Sample pixels more efficiently (every nth pixel for speed)
    const sampleRate = Math.max(1, Math.floor(Math.min(width, height) / 500)) // More samples for better accuracy
    console.log('📊 Using sample rate:', sampleRate)
    
    let minX = width, maxX = 0, minY = height, maxY = 0
    let hasContent = false
    let contentPixelCount = 0

    // Scan pixels with sampling to find content boundaries
    for (let y = 0; y < height; y += sampleRate) {
      for (let x = 0; x < width; x += sampleRate) {
        const i = (y * width + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]

        if (isContentPixel(r, g, b, a)) {
          hasContent = true
          contentPixelCount++
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
    }

    console.log('📈 Content pixels found:', contentPixelCount)

    if (!hasContent) {
      console.log('⚠️ No content detected, using full canvas')
      return { x: 0, y: 0, width: canvas.width, height: canvas.height }
    }

    // Add moderate padding around detected content
    const paddingPercent = 0.05 // 5% of the smaller dimension
    const padding = Math.max(10, Math.floor(Math.min(width, height) * paddingPercent))
    
    const contentX = Math.max(0, minX - padding)
    const contentY = Math.max(0, minY - padding)
    const contentWidth = Math.min(width - contentX, maxX - minX + (padding * 2))
    const contentHeight = Math.min(height - contentY, maxY - minY + (padding * 2))

    // Ensure minimum dimensions (don't crop too aggressively)
    const minWidth = Math.min(width * 0.5, 200) // More conservative minimum
    const minHeight = Math.min(height * 0.5, 200)

    const finalWidth = Math.max(contentWidth, minWidth)
    const finalHeight = Math.max(contentHeight, minHeight)

    console.log('✅ Content bounds detected:', { 
      contentX, 
      contentY, 
      contentWidth: finalWidth, 
      contentHeight: finalHeight,
      originalBounds: { minX, maxX, minY, maxY },
      padding: padding
    })

    return { x: contentX, y: contentY, width: finalWidth, height: finalHeight }
  }

  // Precise image cropping function with smart content detection
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

    // Create a temporary canvas for the initial crop
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) {
      throw new Error('Could not get canvas context')
    }

    // Set dimensions to match the crop area
    tempCanvas.width = actualWidth
    tempCanvas.height = actualHeight

    // Extract the initial cropped portion
    tempCtx.drawImage(
      canvas,
      actualX, actualY, actualWidth, actualHeight,  // Source coordinates
      0, 0, actualWidth, actualHeight               // Destination coordinates
    )

    // Apply smart cropping if enabled
    if (smartCropping) {
      console.log('🎯 Smart cropping ENABLED - detecting content bounds...')
      // Detect content boundaries to trim whitespace
      const contentBounds = detectContentBounds(tempCanvas)

      // Create final canvas with trimmed dimensions
      const finalCanvas = document.createElement('canvas')
      const finalCtx = finalCanvas.getContext('2d')
      if (!finalCtx) {
        throw new Error('Could not get final canvas context')
      }

      finalCanvas.width = contentBounds.width
      finalCanvas.height = contentBounds.height

      // Draw only the content area to the final canvas
      finalCtx.drawImage(
        tempCanvas,
        contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height,  // Source
        0, 0, contentBounds.width, contentBounds.height                                // Destination
      )

      // Convert to high-quality data URL
      const imageData = finalCanvas.toDataURL('image/png', 1.0)
      console.log('✅ Smart cropped image created, size:', imageData.length, 'bytes')
      console.log('Final canvas size:', finalCanvas.width, 'x', finalCanvas.height)
      console.log('Whitespace removed:', {
        originalSize: `${tempCanvas.width}x${tempCanvas.height}`,
        finalSize: `${finalCanvas.width}x${finalCanvas.height}`,
        spaceSaved: `${Math.round(((tempCanvas.width * tempCanvas.height) - (finalCanvas.width * finalCanvas.height)) / (tempCanvas.width * tempCanvas.height) * 100)}%`
      })
      
      return imageData
    } else {
      console.log('📏 Smart cropping DISABLED - using manual crop bounds')
      // Use manual cropping (original behavior)
      const imageData = tempCanvas.toDataURL('image/png', 1.0)
      console.log('✅ Manual cropped image created, size:', imageData.length, 'bytes')
      console.log('Manual canvas size:', tempCanvas.width, 'x', tempCanvas.height)
      
      return imageData
    }
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
        description: smartCropping 
          ? `Added Question ${newQuestion.questionNumber} - Smart cropped and saved` 
          : `Added Question ${newQuestion.questionNumber} - Image saved successfully`,
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
    setVisitedTestQuestions(new Set([0]))
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
      const nextIndex = currentTestQuestion + 1
      setCurrentTestQuestion(nextIndex)
      setVisitedTestQuestions(prev => new Set([...prev, nextIndex]))
    }
  }

  const previousQuestion = () => {
    if (currentTestQuestion > 0) {
      const prevIndex = currentTestQuestion - 1
      setCurrentTestQuestion(prevIndex)
      setVisitedTestQuestions(prev => new Set([...prev, prevIndex]))
    }
  }

  const navigateToTestQuestion = (questionIndex: number) => {
    setCurrentTestQuestion(questionIndex)
    setVisitedTestQuestions(prev => new Set([...prev, questionIndex]))
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

  // Helper function to upload image to Supabase Storage
  const uploadImageToStorage = async (imageData: string, questionId: string): Promise<string | null> => {
    try {
      console.log('Uploading image to storage for question:', questionId)
      
      // Convert base64 to blob
      const base64Data = imageData.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })

      // Create unique filename
      const fileName = `questions/${user.id}/${questionId}_${Date.now()}.png`
      
      console.log('Uploading to path:', fileName)
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('question-images')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Storage upload error:', error)
        // If storage fails, fall back to base64 in database
        return imageData
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName)

      console.log('Public URL generated:', publicUrl)
      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      // Fallback to base64 storage if upload fails
      return imageData
    }
  }

  // Save test to Supabase
  const saveTestToSupabase = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your test",
        variant: "destructive"
      })
      return
    }

    console.log('Current user:', user)

    if (questions.length === 0) {
      toast({
        title: "No questions to save",
        description: "Please add some questions before saving the test",
        variant: "destructive"
      })
      return
    }

    if (!testTitle.trim()) {
      toast({
        title: "Test title required",
        description: "Please enter a title for your test",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)

    try {
      console.log('Starting test save process...')
      
      // Test the database connection and user permissions
      console.log('Testing database connection and permissions...')
      const { data: permissionTest, error: permissionError } = await supabase
        .from('tests')
        .select('id')
        .limit(1)

      if (permissionError) {
        console.error('Permission/connection error:', permissionError)
        if (permissionError.code === 'PGRST116') {
          throw new Error('Database table not found. Please check your database setup.')
        } else if (permissionError.message.includes('JWT')) {
          throw new Error('Authentication token invalid. Please log out and log back in.')
        } else if (permissionError.message.includes('RLS')) {
          throw new Error('Database access denied. Please check your database policies.')
        } else {
          throw new Error(`Database error: ${permissionError.message}`)
        }
      }

      console.log('Database permissions verified')
      
      // Create the test record
      const testPayload = {
        user_id: user.id,
        title: testTitle.trim(),
        pdf_name: pdfFile?.name || 'PDF Questions',
        status: 'ready'
      }

      console.log('Creating test with payload:', testPayload)

      const { data: testData, error: testError } = await supabase
        .from('tests')
        .insert(testPayload)
        .select()
        .single()

      if (testError) {
        console.error('Test creation error:', testError)
        throw new Error(`Failed to create test: ${testError.message}`)
      }

      console.log('Test created successfully:', testData)

      // Upload images to storage and save questions
      console.log('Uploading images to storage...')
      const questionsToSave = []

      for (const question of questions) {
        console.log(`Processing question ${question.questionNumber}...`)
        
        // Upload image to storage and get URL
        const imageUrl = await uploadImageToStorage(question.imageData, question.id)
        
        // Determine if we got a URL or fell back to base64
        const isStorageUrl = imageUrl && imageUrl.startsWith('http')
        
        questionsToSave.push({
          test_id: testData.id,
          question_number: question.questionNumber,
          question_text: JSON.stringify({
            type: 'image',
            imageUrl: isStorageUrl ? imageUrl : null,
            imageData: isStorageUrl ? null : imageUrl, // Fallback to base64 if storage failed
            questionNumber: question.questionNumber,
            storageMethod: isStorageUrl ? 'url' : 'base64'
          }),
          option_a: 'Option A',
          option_b: 'Option B',
          option_c: 'Option C', 
          option_d: 'Option D',
          correct_answer: question.correctAnswer || 'A'
        })
        
        console.log(`Question ${question.questionNumber} processed with ${isStorageUrl ? 'storage URL' : 'base64 fallback'}`)
      }

      console.log('Preparing to save questions with storage URLs:', questionsToSave.length)

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsToSave)

      if (questionsError) {
        console.error('Questions creation error:', questionsError)
        throw questionsError
      }

      console.log('Questions saved successfully')

      toast({
        title: "Test saved successfully!",
        description: `"${testTitle}" has been saved to your account. Visit the dashboard to view it.`,
      })

      // Clear the form
      setTestTitle('')

    } catch (error) {
      console.error('Detailed error saving test:', error)
      toast({
        title: "Failed to save test",
        description: error.message || "There was an error saving your test. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
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
              {user && (
                <Button 
                  onClick={() => saveTestToSupabase()}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!testTitle.trim()}
                >
                  <Save className="h-4 w-4 mr-2" />
                  💾 Save Test
                </Button>
              )}
              {!user && (
                <Button 
                  onClick={() => window.open('/auth', '_blank')}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Login to Save Test
                </Button>
              )}
            </div>

            {/* Save Test Input */}
            {user && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="space-y-3">
                  <Label htmlFor="test-title-results" className="text-sm font-medium text-green-800">
                    💾 Save this test to your account:
                  </Label>
                  <Input
                    id="test-title-results"
                    type="text"
                    placeholder="Enter test name (e.g., Math Quiz - Chapter 5)"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="border-green-300 focus:border-green-500"
                  />
                  <p className="text-xs text-green-700">
                    💡 Give your test a descriptive name so you can find it easily in your dashboard
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isTestMode) {
    const progress = (Object.keys(testAnswers).length / questions.length) * 100;
    const currentQuestion = questions[currentTestQuestion];

    return (
      <div className="min-h-screen bg-[var(--gradient-hero)]">
        <header className="bg-card/50 backdrop-blur-sm border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Test Preview</h1>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(testAnswers).length} of {questions.length} answered
                  </span>
                  <Button variant="outline" onClick={() => setIsTestMode(false)}>
                    Exit Test
                  </Button>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Left Side - Question Display */}
            <div className="lg:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground text-sm font-bold">
                      {currentTestQuestion + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-lg">Question {currentTestQuestion + 1}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Select your answer from the options below
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Question Image */}
                  {currentQuestion?.imageData && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <img 
                        src={currentQuestion.imageData} 
                        alt={`Question ${currentQuestion.questionNumber}`}
                        className="w-full max-w-2xl h-auto object-contain"
                      />
                    </div>
                  )}

                  {/* Answer Options */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Select your answer:</Label>
                    <div className="space-y-3">
                      {['A', 'B', 'C', 'D'].map((option) => (
                        <div
                          key={option}
                          className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            testAnswers[currentQuestion?.id] === option
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setTestAnswers(prev => ({ ...prev, [currentQuestion?.id]: option }))}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            testAnswers[currentQuestion?.id] === option
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}>
                            {testAnswers[currentQuestion?.id] === option ? option : option}
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold mr-2">{option}.</span>
                            Option {option}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={previousQuestion}
                  disabled={currentTestQuestion === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                {currentTestQuestion === questions.length - 1 ? (
                  <Button onClick={finishTest} className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Finish Test
                  </Button>
                ) : (
                  <Button onClick={nextQuestion}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>

            {/* Right Side - CBT Question Navigation Panel */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg border p-4 sticky top-24">
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-3">Question Palette</h3>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded flex items-center justify-center font-medium text-xs border">
                        {questions.length.toString().padStart(2, '0')}
                      </div>
                      <span className="text-gray-600">Not Visited</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center font-medium text-xs">
                        01
                      </div>
                      <span className="text-gray-600">Not Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-500 text-white rounded flex items-center justify-center font-medium text-xs">
                        01
                      </div>
                      <span className="text-gray-600">Answered</span>
                    </div>
                  </div>

                  {/* Question Grid */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-8 gap-1 max-h-96 overflow-y-auto">
                      {questions.map((q, idx) => {
                        const isAnswered = !!testAnswers[q.id];
                        const isCurrent = currentTestQuestion === idx;
                        const isVisited = visitedTestQuestions.has(idx);
                        
                        // Determine button style based on state
                        let buttonClass = "w-8 h-8 text-xs font-medium rounded transition-all flex items-center justify-center border cursor-pointer ";
                        
                        if (isCurrent) {
                          // Current question - highlighted border
                          if (isAnswered) {
                            buttonClass += "bg-green-500 text-white border-2 border-blue-400 shadow-lg";
                          } else if (isVisited) {
                            buttonClass += "bg-red-500 text-white border-2 border-blue-400 shadow-lg";
                          } else {
                            buttonClass += "bg-gray-200 text-gray-600 border-2 border-blue-400 shadow-lg";
                          }
                        } else if (isAnswered) {
                          // Answered (green)
                          buttonClass += "bg-green-500 text-white border-green-600 hover:bg-green-600";
                        } else if (isVisited) {
                          // Visited but not answered (red)
                          buttonClass += "bg-red-500 text-white border-red-600 hover:bg-red-600";
                        } else {
                          // Not visited (gray)
                          buttonClass += "bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300";
                        }
                        
                        return (
                          <button
                            key={q.id}
                            className={buttonClass}
                            onClick={() => navigateToTestQuestion(idx)}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress Summary */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          {Object.keys(testAnswers).length}
                        </div>
                        <div className="text-xs text-gray-600">Answered</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">
                          {questions.length - Object.keys(testAnswers).length}
                        </div>
                        <div className="text-xs text-gray-600">Not Answered</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t pt-4 space-y-2">
                    <button
                      className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      onClick={() => {
                        const nextUnanswered = questions.findIndex((q, idx) => !testAnswers[q.id] && idx > currentTestQuestion);
                        if (nextUnanswered !== -1) {
                          navigateToTestQuestion(nextUnanswered);
                        }
                      }}
                      disabled={Object.keys(testAnswers).length === questions.length}
                    >
                      Next Unanswered
                    </button>
                    
                    {Object.keys(testAnswers).length === questions.length && (
                      <button
                        onClick={finishTest}
                        className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Finish Test
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
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

              {/* Smart Cropping Toggle */}
              {pdfFile && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <div>
                      <Label htmlFor="smart-crop" className="text-sm font-medium text-blue-900">
                        Smart Cropping
                      </Label>
                      <p className="text-xs text-blue-700">
                        Automatically trims whitespace around questions
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="smart-crop"
                    checked={smartCropping}
                    onCheckedChange={(checked) => {
                      console.log('🔄 Smart cropping toggle changed to:', checked)
                      setSmartCropping(checked)
                    }}
                  />
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
                  <div key={question.id} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">Q{question.questionNumber}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          Page {question.cropData.page}
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
                    
                    {/* Answer Key Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Correct Answer:</Label>
                      <Select
                        value={question.correctAnswer || 'A'}
                        onValueChange={(value) => {
                          setQuestions(prev => 
                            prev.map(q => 
                              q.id === question.id 
                                ? { ...q, correctAnswer: value as 'A' | 'B' | 'C' | 'D' }
                                : q
                            )
                          )
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="C">C</SelectItem>
                          <SelectItem value="D">D</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
              {/* Save Test Section */}
              {user && (
                <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <Label htmlFor="test-title" className="text-sm font-medium text-green-900">
                    Save Test to Account
                  </Label>
                  <div className="text-xs text-green-700 mb-2">
                    Logged in as: {user.email}
                  </div>
                  <Input
                    id="test-title"
                    placeholder="Enter test title..."
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    className="bg-white"
                  />
                  <Button
                    onClick={saveTestToSupabase}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={questions.length === 0 || isSaving || !testTitle.trim()}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Test'}
                  </Button>
                  <Button
                    onClick={() => navigate('/dashboard')}
                    variant="outline"
                    className="w-full"
                  >
                    View Dashboard
                  </Button>
                  
                  {/* Debug button to test database access */}
                  <Button
                    onClick={async () => {
                      try {
                        console.log('Testing database access...')
                        console.log('Current user:', user)
                        
                        // Test 1: Check auth
                        const { data: authData, error: authError } = await supabase.auth.getUser()
                        console.log('Auth test:', { authData, authError })
                        
                        // Test 2: Check database read access
                        const { data, error } = await supabase
                          .from('tests')
                          .select('id, title')
                          .limit(5)
                        
                        console.log('Database read test:', { data, error })
                        
                        if (error) {
                          toast({
                            title: "Database Test Failed",
                            description: `Error: ${error.message} (Code: ${error.code})`,
                            variant: "destructive"
                          })
                        } else {
                          toast({
                            title: "Database Test Successful",
                            description: `Auth: ${authData.user ? 'OK' : 'FAIL'}, Found ${data.length} tests`,
                          })
                        }
                      } catch (err) {
                        console.error('Database test exception:', err)
                        toast({
                          title: "Test Exception",
                          description: err.message,
                          variant: "destructive"
                        })
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                  >
                    Test Database Connection
                  </Button>
                </div>
              )}

              {!user && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 text-center">
                    <a href="/auth" className="font-medium underline">Login</a> to save tests to your account
                  </p>
                </div>
              )}

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