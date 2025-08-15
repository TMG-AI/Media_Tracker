import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { 
  Search, 
  Twitter, 
  Newspaper, 
  FileSpreadsheet, 
  Play, 
  Pause, 
  Settings, 
  Eye,
  Users,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import './App.css'

function App() {
  const [config, setConfig] = useState({
    clientName: '',
    searchTerms: '',
    twitterApiKey: '',
    twitterApiSecret: '',
    twitterBearerToken: '',
    googleSheetsId: '',
    googleApiKey: '',
    meltwaterApiKey: '',
    meltwaterWebhookUrl: ''
  })
  
  const [isRunning, setIsRunning] = useState(false)
  const [lastRun, setLastRun] = useState(null)
  const [results, setResults] = useState({
    twitter: [],
    news: [],
    meltwater: [],
    totalPosts: 0,
    totalArticles: 0,
    totalMeltwaterItems: 0
  })
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)

  // Load saved configuration on startup
  useEffect(() => {
    const savedConfig = localStorage.getItem('mediaTrackerConfig')
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig))
    }
  }, [])

  // Save configuration to localStorage
  const saveConfig = () => {
    localStorage.setItem('mediaTrackerConfig', JSON.stringify(config))
    addLog('Configuration saved successfully', 'success')
  }

  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleString()
    setLogs(prev => [{
      id: Date.now(),
      timestamp,
      message,
      type
    }, ...prev.slice(0, 49)]) // Keep last 50 logs
  }

  // Real API data collection using serverless function
  const runDataCollection = async () => {
    if (!config.clientName || !config.searchTerms) {
      addLog('Please configure client name and search terms first', 'error')
      return
    }

    setIsRunning(true)
    setProgress(0)
    addLog(`Starting data collection for ${config.clientName}`, 'info')

    try {
      // Check if we have API keys configured
      const hasRealAPIs = config.twitterBearerToken || config.googleApiKey || config.meltwaterApiKey
      
      if (!hasRealAPIs) {
        addLog('No API keys configured - running in demo mode with sample data', 'info')
        
        // Use mock data for demo
        setProgress(20)
        addLog('Generating sample Twitter/X posts...', 'info')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const twitterData = generateMockTwitterData(config.searchTerms, config.clientName)
        
        setProgress(50)
        addLog('Generating sample news articles...', 'info')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const newsData = generateMockNewsData(config.searchTerms, config.clientName)
        
        setProgress(70)
        addLog('Generating sample Meltwater data...', 'info')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const meltwaterData = generateMockMeltwaterData(config.searchTerms, config.clientName)
        
        setProgress(80)
        addLog('Demo mode - skipping Google Sheets update', 'info')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setProgress(100)
        setResults({
          twitter: twitterData,
          news: newsData,
          meltwater: meltwaterData,
          totalPosts: twitterData.length,
          totalArticles: newsData.length,
          totalMeltwaterItems: meltwaterData.length
        })
        
        setLastRun(new Date())
        addLog(`Demo completed! Generated ${twitterData.length} sample posts, ${newsData.length} sample articles, and ${meltwaterData.length} Meltwater items`, 'success')
        
      } else {
        // Use serverless API for real data collection
        setProgress(20)
        addLog('Connecting to data collection API...', 'info')
        
        const response = await fetch('/api/collect-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ config })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `API error: ${response.status}`)
        }
        
        setProgress(50)
        addLog('Processing collected data...', 'info')
        
        const result = await response.json()
        
        if (result.data.errors.length > 0) {
          result.data.errors.forEach(error => addLog(error, 'error'))
        }
        
        setProgress(100)
        setResults({
          twitter: result.data.twitter,
          news: result.data.news,
          meltwater: result.data.meltwater,
          totalPosts: result.totalPosts,
          totalArticles: result.totalArticles,
          totalMeltwaterItems: result.totalMeltwaterItems || 0
        })
        
        setLastRun(new Date())
        addLog(`Data collection completed! Found ${result.totalPosts} posts, ${result.totalArticles} articles, and ${result.totalMeltwaterItems || 0} Meltwater items`, 'success')
      }
      
    } catch (error) {
      addLog(`Error during data collection: ${error.message}`, 'error')
      console.error('Collection error:', error)
    } finally {
      setIsRunning(false)
      setProgress(0)
    }
  }

  // Generate mock Twitter data
  const generateMockTwitterData = (searchTerms, clientName) => {
    const terms = searchTerms.split(',').map(t => t.trim())
    const mockData = []
    
    for (let i = 0; i < Math.floor(Math.random() * 10) + 5; i++) {
      const randomTerm = terms[Math.floor(Math.random() * terms.length)]
      mockData.push({
        id: `tweet_${i}`,
        link: `https://x.com/user${i}/status/123456789${i}`,
        views: Math.floor(Math.random() * 50000) + 1000,
        handle: `@user${i}`,
        followers: Math.floor(Math.random() * 100000) + 1000,
        content: `Great news about ${randomTerm} and ${clientName}! This is really exciting for the industry.`,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
      })
    }
    
    return mockData.sort((a, b) => b.views - a.views)
  }

  // Generate mock news data
  const generateMockNewsData = (searchTerms, clientName) => {
    const publications = ['TechCrunch', 'Reuters', 'Bloomberg', 'The Verge', 'Coindesk', 'Fortune']
    const reporters = ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez', 'David Kim']
    const terms = searchTerms.split(',').map(t => t.trim())
    const mockData = []
    
    for (let i = 0; i < Math.floor(Math.random() * 8) + 3; i++) {
      const randomTerm = terms[Math.floor(Math.random() * terms.length)]
      const publication = publications[Math.floor(Math.random() * publications.length)]
      const reporter = reporters[Math.floor(Math.random() * reporters.length)]
      
      mockData.push({
        id: `article_${i}`,
        publication,
        headline: `${clientName} Announces Major ${randomTerm} Partnership`,
        link: `https://${publication.toLowerCase().replace(' ', '')}.com/article-${i}`,
        reporter,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        notes: ''
      })
    }
    
    return mockData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  // Generate mock Meltwater data
  const generateMockMeltwaterData = (searchTerms, clientName) => {
    const publications = ['Reuters', 'Bloomberg', 'Financial Times', 'Wall Street Journal', 'TechCrunch', 'Forbes']
    const reporters = ['Sarah Wilson', 'Michael Brown', 'Jennifer Lee', 'David Martinez', 'Emily Chen']
    const sentiments = ['positive', 'neutral', 'negative']
    const terms = searchTerms.split(',').map(t => t.trim())
    const mockData = []
    
    for (let i = 0; i < Math.floor(Math.random() * 12) + 5; i++) {
      const randomTerm = terms[Math.floor(Math.random() * terms.length)]
      const publication = publications[Math.floor(Math.random() * publications.length)]
      const reporter = reporters[Math.floor(Math.random() * reporters.length)]
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)]
      
      mockData.push({
        id: `meltwater_${i}`,
        publication,
        headline: `${clientName} ${randomTerm} Coverage Analysis - Market Impact Study`,
        link: `https://${publication.toLowerCase().replace(' ', '')}.com/meltwater-article-${i}`,
        reporter,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        reach: Math.floor(Math.random() * 500000) + 10000,
        engagement: Math.floor(Math.random() * 50000) + 1000,
        sentiment,
        notes: ''
      })
    }
    
    return mockData.sort((a, b) => b.reach - a.reach)
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Media Tracker</h1>
            <p className="text-muted-foreground">PR Monitoring Dashboard for {config.clientName || 'Your Client'}</p>
          </div>
          <div className="flex items-center gap-4">
            {lastRun && (
              <div className="text-sm text-muted-foreground">
                Last run: {lastRun.toLocaleString()}
              </div>
            )}
            <Button 
              onClick={runDataCollection} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Collection
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Data Collection Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Twitter Posts</CardTitle>
              <Twitter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                From last collection
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">News Articles</CardTitle>
              <Newspaper className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.totalArticles}</div>
              <p className="text-xs text-muted-foreground">
                From last collection
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meltwater Items</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{results.totalMeltwaterItems}</div>
              <p className="text-xs text-muted-foreground">
                From last collection
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {results.twitter.reduce((sum, post) => sum + post.views, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all posts
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isRunning ? 'Running' : 'Ready'}
              </div>
              <p className="text-xs text-muted-foreground">
                System status
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="results" className="space-y-4">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Twitter Posts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Twitter className="h-5 w-5" />
                    Twitter/X Posts
                  </CardTitle>
                  <CardDescription>
                    Recent posts mentioning your client
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.twitter.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No posts collected yet. Run data collection to see results.
                      </p>
                    ) : (
                      results.twitter.map((post) => (
                        <div key={post.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{post.handle}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {post.followers.toLocaleString()} followers
                              </span>
                            </div>
                            <Badge variant="outline">
                              <Eye className="h-3 w-3 mr-1" />
                              {post.views.toLocaleString()}
                            </Badge>
                          </div>
                          <p className="text-sm">{post.content}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.timestamp).toLocaleString()}
                            </span>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={post.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Post
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* News Articles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Newspaper className="h-5 w-5" />
                    News Articles
                  </CardTitle>
                  <CardDescription>
                    Recent news coverage
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.news.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No articles collected yet. Run data collection to see results.
                      </p>
                    ) : (
                      results.news.map((article) => (
                        <div key={article.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">{article.publication}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(article.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-medium">{article.headline}</h4>
                          <p className="text-sm text-muted-foreground">
                            By {article.reporter}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              Notes: {article.notes || 'None'}
                            </span>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={article.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Read Article
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Meltwater Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Meltwater Coverage
                  </CardTitle>
                  <CardDescription>
                    Media monitoring and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.meltwater.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No Meltwater data collected yet. Run data collection to see results.
                      </p>
                    ) : (
                      results.meltwater.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">{item.publication}</Badge>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={
                                item.sentiment === 'positive' ? 'border-green-500 text-green-700' :
                                item.sentiment === 'negative' ? 'border-red-500 text-red-700' :
                                'border-gray-500 text-gray-700'
                              }>
                                {item.sentiment}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Reach: {item.reach?.toLocaleString() || 0}
                              </span>
                            </div>
                          </div>
                          <h4 className="font-medium">{item.headline}</h4>
                          <p className="text-sm text-muted-foreground">
                            By {item.reporter}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={item.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Article
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration
                </CardTitle>
                <CardDescription>
                  Set up your API keys and monitoring parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      placeholder="e.g., Coinbase"
                      value={config.clientName}
                      onChange={(e) => setConfig(prev => ({...prev, clientName: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="searchTerms">Search Terms (comma-separated)</Label>
                    <Input
                      id="searchTerms"
                      placeholder="e.g., Coinbase, crypto, blockchain"
                      value={config.searchTerms}
                      onChange={(e) => setConfig(prev => ({...prev, searchTerms: e.target.value}))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">API Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="twitterBearerToken">Twitter Bearer Token</Label>
                      <Input
                        id="twitterBearerToken"
                        type="password"
                        placeholder="Your Twitter API Bearer Token"
                        value={config.twitterBearerToken}
                        onChange={(e) => setConfig(prev => ({...prev, twitterBearerToken: e.target.value}))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="googleApiKey">Google API Key</Label>
                      <Input
                        id="googleApiKey"
                        type="password"
                        placeholder="Your Google API Key"
                        value={config.googleApiKey}
                        onChange={(e) => setConfig(prev => ({...prev, googleApiKey: e.target.value}))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meltwaterApiKey">Meltwater API Key</Label>
                    <Input
                      id="meltwaterApiKey"
                      type="password"
                      placeholder="Your Meltwater API Key"
                      value={config.meltwaterApiKey}
                      onChange={(e) => setConfig(prev => ({...prev, meltwaterApiKey: e.target.value}))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="googleSheetsId">Google Sheets ID</Label>
                    <Input
                      id="googleSheetsId"
                      placeholder="The ID from your Google Sheets URL"
                      value={config.googleSheetsId}
                      onChange={(e) => setConfig(prev => ({...prev, googleSheetsId: e.target.value}))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meltwaterWebhookUrl">Meltwater Webhook URL (Optional)</Label>
                    <Input
                      id="meltwaterWebhookUrl"
                      placeholder="https://your-webhook-url.com"
                      value={config.meltwaterWebhookUrl}
                      onChange={(e) => setConfig(prev => ({...prev, meltwaterWebhookUrl: e.target.value}))}
                    />
                  </div>
                </div>

                <Button onClick={saveConfig} className="w-full">
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>
                  Recent activity and system messages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No logs yet. System activity will appear here.
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2 rounded border">
                        <div className="flex-shrink-0 mt-1">
                          {log.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {log.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          {log.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{log.message}</p>
                          <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App

