// Test script to check your current storage usage
// Run this in the browser console on your app

async function checkMyStorageUsage() {
  try {
    console.log('🔍 Checking your Supabase storage usage...\n')
    
    // Import the function (this works in the browser console when the app is loaded)
    const { getStorageUsageReport, checkStorageLimits } = await import('./storageMonitor')
    
    // Get detailed usage report
    const report = await getStorageUsageReport()
    console.log(report)
    
    // Check limits
    const limits = await checkStorageLimits()
    console.log('\n📈 Limit Status:')
    console.log(`- Percentage Used: ${limits.percentageUsed}%`)
    console.log(`- Remaining Space: ${limits.remainingMB} MB`)
    console.log(`- Status: ${limits.message}`)
    console.log(`- Near Limit: ${limits.isNearLimit ? 'YES ⚠️' : 'NO ✅'}`)
    
    return { report, limits }
    
  } catch (importError) {
    console.error('❌ Error checking storage:', importError)
    
    // Fallback: try to check buckets directly
    console.log('\n🔄 Trying direct bucket check...')
    
    try {
      const { supabase } = await import('../integrations/supabase/client')
      
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      
      if (bucketsError) {
        console.error('❌ Could not fetch buckets:', bucketsError)
        return null
      }
      
      console.log('📁 Found buckets:', buckets?.map(b => b.name) || [])
      
      for (const bucket of buckets || []) {
        console.log(`\n📂 Checking bucket: ${bucket.name}`)
        
        const { data: files, error: filesError } = await supabase.storage
          .from(bucket.name)
          .list('', { limit: 100 })
          
        if (filesError) {
          console.log(`❌ Error accessing ${bucket.name}:`, filesError.message)
        } else {
          console.log(`📄 Files in ${bucket.name}: ${files?.length || 0}`)
          
          if (files && files.length > 0) {
            const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
            console.log(`💾 Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`)
          }
        }
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError)
    }
  }
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  console.log('🚀 Storage usage checker loaded! Run: checkMyStorageUsage()')
}

export { checkMyStorageUsage }