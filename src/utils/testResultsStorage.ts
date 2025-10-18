import { supabase } from '@/integrations/supabase/client'

export interface TestResult {
  testId: string
  testTitle: string
  questions: any[]
  answers: {[key: string]: string}
  score: number
  totalQuestions: number
  completedAt: string
  timeSpent?: number
  isFromZipImport?: boolean
}

export interface LocalTestResult extends TestResult {
  id: string
  storedAt: string
}

/**
 * Storage utility for test results with multiple storage options
 */
export class TestResultsStorage {
  private static LOCAL_STORAGE_KEY = 'cbt_test_results'
  
  /**
   * Save result to Supabase (for logged-in users with saved tests)
   */
  static async saveToDatabase(result: TestResult): Promise<boolean> {
    try {
      const session = await supabase.auth.getSession()
      if (!session.data.session?.user) {
        throw new Error('User not authenticated')
      }

      const userAnswers = result.questions.map((q) => ({
        user_id: session.data.session.user.id,
        test_id: result.testId,
        question_id: q.id,
        selected_answer: result.answers[q.id] || "",
        is_correct: result.answers[q.id] === q.correct_answer,
      }))

      const { error } = await supabase.from("user_answers").upsert(userAnswers)
      
      if (error) {
        console.error('Database save error:', error)
        return false
      }
      
      return true
    } catch (error) {
      console.error('Error saving to database:', error)
      return false
    }
  }

  /**
   * Save result to localStorage (for practice tests, ZIP imports, offline backup)
   */
  static saveToLocalStorage(result: TestResult): boolean {
    try {
      const existingResults = this.getFromLocalStorage()
      const newResult: LocalTestResult = {
        ...result,
        id: `local_${Date.now()}`,
        storedAt: new Date().toISOString()
      }
      
      existingResults.push(newResult)
      
      // Keep only last 50 results to prevent storage bloat
      if (existingResults.length > 50) {
        existingResults.splice(0, existingResults.length - 50)
      }
      
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(existingResults))
      return true
    } catch (error) {
      console.error('Error saving to localStorage:', error)
      return false
    }
  }

  /**
   * Get all results from localStorage
   */
  static getFromLocalStorage(): LocalTestResult[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return []
    }
  }

  /**
   * Smart save - tries database first, falls back to localStorage
   */
  static async smartSave(result: TestResult): Promise<{
    database: boolean
    localStorage: boolean
    method: 'database' | 'localStorage' | 'both'
  }> {
    let databaseSaved = false
    let localStorageSaved = false

    // Try database first for authenticated users
    const session = await supabase.auth.getSession()
    if (session.data.session?.user && !result.isFromZipImport) {
      databaseSaved = await this.saveToDatabase(result)
    }

    // Always save to localStorage as backup
    localStorageSaved = this.saveToLocalStorage(result)

    const method = databaseSaved && localStorageSaved ? 'both' 
                 : databaseSaved ? 'database'
                 : localStorageSaved ? 'localStorage'
                 : 'database' // fallback

    return {
      database: databaseSaved,
      localStorage: localStorageSaved,
      method
    }
  }

  /**
   * Clear old localStorage results
   */
  static clearLocalStorage(): boolean {
    try {
      localStorage.removeItem(this.LOCAL_STORAGE_KEY)
      return true
    } catch (error) {
      console.error('Error clearing localStorage:', error)
      return false
    }
  }

  /**
   * Get result by ID from localStorage
   */
  static getLocalResultById(id: string): LocalTestResult | null {
    const results = this.getFromLocalStorage()
    return results.find(r => r.id === id) || null
  }

  /**
   * Export results as JSON file
   */
  static exportResults(results: LocalTestResult[]): void {
    try {
      const dataStr = JSON.stringify(results, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cbt_test_results_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting results:', error)
    }
  }
}