import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { getStorageUsage, checkStorageLimits, type StorageUsage } from '@/utils/storageMonitor'
import { RefreshCw, Database, HardDrive, AlertTriangle } from 'lucide-react'

export const StorageUsageCard = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limits, setLimits] = useState<any>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [usageData, limitsData] = await Promise.all([
        getStorageUsage(),
        checkStorageLimits()
      ])
      
      setUsage(usageData)
      setLimits(limitsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch storage usage')
      console.error('Storage usage error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage Usage
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchUsage}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-red-600 p-3 bg-red-50 rounded-lg">
            Error: {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Fetching storage usage...</p>
          </div>
        )}

        {usage && limits && !loading && (
          <>
            {/* Overall Usage */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Usage</span>
                <span className="text-sm text-gray-600">
                  {usage.totalSizeMB} MB / 1,024 MB
                </span>
              </div>
              
              <Progress 
                value={limits.percentageUsed} 
                className="h-2"
              />
              
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{limits.percentageUsed}% used</span>
                <span>{limits.remainingMB} MB remaining</span>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              limits.isNearLimit 
                ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' 
                : 'bg-green-50 text-green-800 border border-green-200'
            }`}>
              {limits.isNearLimit && <AlertTriangle className="h-4 w-4" />}
              <Database className="h-4 w-4" />
              <span className="text-sm">{limits.message}</span>
            </div>

            {/* File Count */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">
                  {usage.totalFiles}
                </div>
                <div className="text-sm text-gray-600">Total Files</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">
                  {formatFileSize(usage.totalSizeBytes)}
                </div>
                <div className="text-sm text-gray-600">Total Size</div>
              </div>
            </div>

            {/* Bucket Breakdown */}
            {Object.keys(usage.bucketUsage).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Bucket Breakdown</h4>
                {Object.entries(usage.bucketUsage).map(([bucketName, bucketData]) => (
                  <div key={bucketName} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm font-medium">{bucketName}</span>
                    <div className="text-right">
                      <div className="text-sm">{bucketData.files} files</div>
                      <div className="text-xs text-gray-600">{bucketData.sizeMB} MB</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            {limits.percentageUsed > 50 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <h5 className="text-sm font-medium text-blue-800 mb-1">💡 Storage Tips:</h5>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Consider compressing images before upload</li>
                  <li>• Delete old or unused test images</li>
                  <li>• Upgrade to Pro plan ($25/month) for 100GB</li>
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default StorageUsageCard