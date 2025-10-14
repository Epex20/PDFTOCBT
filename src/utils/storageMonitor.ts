import { supabase } from '@/integrations/supabase/client'

export interface StorageUsage {
  totalFiles: number
  totalSizeBytes: number
  totalSizeMB: number
  bucketUsage: {
    [bucketName: string]: {
      files: number
      sizeBytes: number
      sizeMB: number
    }
  }
}

/**
 * Get storage usage information for your Supabase project
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  try {
    console.log('Fetching storage usage...')
    
    // Get list of all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error fetching buckets:', bucketsError)
      throw bucketsError
    }

    console.log('Found buckets:', buckets?.map(b => b.name))

    const usage: StorageUsage = {
      totalFiles: 0,
      totalSizeBytes: 0,
      totalSizeMB: 0,
      bucketUsage: {}
    }

    // Check each bucket
    for (const bucket of buckets || []) {
      console.log(`Checking bucket: ${bucket.name}`)
      
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', {
          limit: 1000, // Adjust if you have more files
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (filesError) {
        console.error(`Error fetching files from ${bucket.name}:`, filesError)
        continue
      }

      let bucketSize = 0
      let bucketFiles = 0

      if (files) {
        bucketFiles = files.length
        bucketSize = files.reduce((total, file) => {
          return total + (file.metadata?.size || 0)
        }, 0)
      }

      usage.bucketUsage[bucket.name] = {
        files: bucketFiles,
        sizeBytes: bucketSize,
        sizeMB: Number((bucketSize / (1024 * 1024)).toFixed(2))
      }

      usage.totalFiles += bucketFiles
      usage.totalSizeBytes += bucketSize
    }

    usage.totalSizeMB = Number((usage.totalSizeBytes / (1024 * 1024)).toFixed(2))

    console.log('Storage usage calculated:', usage)
    return usage

  } catch (error) {
    console.error('Error getting storage usage:', error)
    throw error
  }
}

/**
 * Get storage usage as a formatted string
 */
export async function getStorageUsageReport(): Promise<string> {
  try {
    const usage = await getStorageUsage()
    
    let report = `📊 Storage Usage Report\n`
    report += `=======================\n`
    report += `Total Files: ${usage.totalFiles}\n`
    report += `Total Size: ${usage.totalSizeMB} MB (${usage.totalSizeBytes} bytes)\n`
    report += `Free Tier Limit: 1 GB (1,024 MB)\n`
    report += `Usage: ${((usage.totalSizeMB / 1024) * 100).toFixed(1)}%\n\n`

    if (Object.keys(usage.bucketUsage).length > 0) {
      report += `Bucket Breakdown:\n`
      report += `-----------------\n`
      
      for (const [bucketName, bucketData] of Object.entries(usage.bucketUsage)) {
        report += `${bucketName}:\n`
        report += `  Files: ${bucketData.files}\n`
        report += `  Size: ${bucketData.sizeMB} MB\n\n`
      }
    }

    return report
  } catch (error) {
    return `Error generating storage report: ${error}`
  }
}

/**
 * Check if approaching storage limits
 */
export async function checkStorageLimits(): Promise<{
  isNearLimit: boolean
  percentageUsed: number
  remainingMB: number
  message: string
}> {
  try {
    const usage = await getStorageUsage()
    const limitMB = 1024 // Free tier limit
    const percentageUsed = (usage.totalSizeMB / limitMB) * 100
    const remainingMB = limitMB - usage.totalSizeMB
    const isNearLimit = percentageUsed > 80

    let message = ''
    if (percentageUsed > 95) {
      message = '🚨 Critical: Storage almost full!'
    } else if (percentageUsed > 80) {
      message = '⚠️ Warning: Storage getting full'
    } else if (percentageUsed > 50) {
      message = '💡 Info: Halfway to storage limit'
    } else {
      message = '✅ Good: Plenty of storage available'
    }

    return {
      isNearLimit,
      percentageUsed: Number(percentageUsed.toFixed(1)),
      remainingMB: Number(remainingMB.toFixed(2)),
      message
    }
  } catch (error) {
    return {
      isNearLimit: false,
      percentageUsed: 0,
      remainingMB: 0,
      message: `Error checking limits: ${error}`
    }
  }
}