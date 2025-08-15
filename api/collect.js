// Serverless function for data collection including Meltwater integration
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { config } = req.body;

    if (!config || !config.clientName || !config.searchTerms) {
      return res.status(400).json({ 
        error: 'Missing required configuration: clientName and searchTerms are required' 
      });
    }

    const results = {
      twitter: [],
      news: [],
      meltwater: [],
      errors: []
    };

    // Twitter API integration
    if (config.twitterBearerToken) {
      try {
        const twitterData = await collectTwitterData(config);
        results.twitter = twitterData;
      } catch (error) {
        results.errors.push(`Twitter: ${error.message}`);
      }
    }

    // Google News API integration
    if (config.googleApiKey) {
      try {
        const newsData = await collectNewsData(config);
        results.news = newsData;
      } catch (error) {
        results.errors.push(`News: ${error.message}`);
      }
    }

    // Meltwater API integration
    if (config.meltwaterApiKey) {
      try {
        const meltwaterData = await collectMeltwaterData(config);
        results.meltwater = meltwaterData;
      } catch (error) {
        results.errors.push(`Meltwater: ${error.message}`);
      }
    }

    // Google Sheets integration
    if (config.googleSheetsId && config.googleApiKey) {
      try {
        await updateGoogleSheets(config, results.twitter, results.news, results.meltwater);
      } catch (error) {
        results.errors.push(`Sheets: ${error.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
      totalPosts: results.twitter.length,
      totalArticles: results.news.length,
      totalMeltwaterItems: results.meltwater.length
    });

  } catch (error) {
    console.error('Data collection error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// Twitter data collection
async function collectTwitterData(config) {
  const query = buildTwitterQuery(config.searchTerms, config.clientName);
  const params = new URLSearchParams({
    query: query,
    max_results: '50',
    'tweet.fields': 'public_metrics,created_at,author_id',
    'user.fields': 'public_metrics,username,name',
    'expansions': 'author_id'
  });

  const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: {
      'Authorization': `Bearer ${config.twitterBearerToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return formatTwitterData(data);
}

// Meltwater data collection
async function collectMeltwaterData(config) {
  const query = buildMeltwaterQuery(config.searchTerms, config.clientName);
  
  // Meltwater API endpoint (this would be your actual Meltwater API endpoint)
  const params = new URLSearchParams({
    q: query,
    limit: '50',
    sort: 'date',
    format: 'json'
  });

  const response = await fetch(`https://api.meltwater.com/v2/searches?${params}`, {
    headers: {
      'Authorization': `Bearer ${config.meltwaterApiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Meltwater API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return formatMeltwaterData(data);
}

// Google News data collection
async function collectNewsData(config) {
  const query = buildNewsQuery(config.searchTerms, config.clientName);
  const params = new URLSearchParams({
    q: query,
    apiKey: config.googleApiKey,
    pageSize: '20',
    sortBy: 'publishedAt',
    language: 'en'
  });

  const response = await fetch(`https://newsapi.org/v2/everything?${params}`);
  
  if (!response.ok) {
    throw new Error(`News API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return formatNewsData(data);
}

// Google Sheets update including Meltwater data
async function updateGoogleSheets(config, twitterData, newsData, meltwaterData) {
  const promises = [];

  // Update Twitter sheet
  if (twitterData.length > 0) {
    const twitterSheetData = formatTwitterDataForSheets(twitterData);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheetsId}/values/Twitter!A1:F${twitterSheetData.length}?valueInputOption=USER_ENTERED&key=${config.googleApiKey}`;
    
    promises.push(
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: twitterSheetData
        })
      })
    );
  }

  // Update News sheet
  if (newsData.length > 0) {
    const newsSheetData = formatNewsDataForSheets(newsData);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheetsId}/values/News!A1:F${newsSheetData.length}?valueInputOption=USER_ENTERED&key=${config.googleApiKey}`;
    
    promises.push(
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: newsSheetData
        })
      })
    );
  }

  // Update Meltwater sheet
  if (meltwaterData.length > 0) {
    const meltwaterSheetData = formatMeltwaterDataForSheets(meltwaterData);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheetsId}/values/Meltwater!A1:H${meltwaterSheetData.length}?valueInputOption=USER_ENTERED&key=${config.googleApiKey}`;
    
    promises.push(
      fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: meltwaterSheetData
        })
      })
    );
  }

  const responses = await Promise.all(promises);
  
  for (const response of responses) {
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }
  }
}

// Helper functions
function buildTwitterQuery(searchTerms, clientName) {
  const terms = searchTerms.split(',').map(t => t.trim());
  const queries = terms.map(term => `"${term}"`);
  
  if (clientName) {
    queries.push(`"${clientName}"`);
  }
  
  return queries.join(' OR ') + ' -is:retweet lang:en';
}

function buildNewsQuery(searchTerms, clientName) {
  const terms = searchTerms.split(',').map(t => t.trim());
  let query = terms.join(' OR ');
  
  if (clientName) {
    query += ` OR "${clientName}"`;
  }
  
  return query;
}

function formatTwitterData(data) {
  if (!data.data || !data.includes?.users) {
    return [];
  }

  const users = data.includes.users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});

  return data.data.map(tweet => {
    const author = users[tweet.author_id];
    return {
      id: tweet.id,
      link: `https://x.com/${author.username}/status/${tweet.id}`,
      views: tweet.public_metrics?.impression_count || 0,
      handle: `@${author.username}`,
      followers: author.public_metrics?.followers_count || 0,
      content: tweet.text,
      timestamp: tweet.created_at,
      retweets: tweet.public_metrics?.retweet_count || 0,
      likes: tweet.public_metrics?.like_count || 0
    };
  });
}

function formatNewsData(data) {
  if (!data.articles) {
    return [];
  }

  return data.articles
    .filter(article => article.title && article.url)
    .map(article => ({
      id: `article_${Date.now()}_${Math.random()}`,
      publication: article.source?.name || 'Unknown',
      headline: article.title,
      link: article.url,
      reporter: article.author || 'Unknown',
      timestamp: article.publishedAt,
      description: article.description,
      notes: ''
    }));
}

function formatTwitterDataForSheets(twitterData) {
  const headers = ['Link', 'Views', 'Handle', 'Followers', 'Content', 'Timestamp'];
  const rows = twitterData.map(post => [
    post.link,
    post.views,
    post.handle,
    post.followers,
    post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
    new Date(post.timestamp).toLocaleString()
  ]);
  
  return [headers, ...rows];
}

function formatNewsDataForSheets(newsData) {
  const headers = ['Publication', 'Headline', 'Link', 'Reporter', 'Timestamp', 'Notes'];
  const rows = newsData.map(article => [
    article.publication,
    article.headline,
    article.link,
    article.reporter,
    new Date(article.timestamp).toLocaleString(),
    article.notes
  ]);
  
  return [headers, ...rows];
}



// Meltwater helper functions
function buildMeltwaterQuery(searchTerms, clientName) {
  const terms = searchTerms.split(',').map(t => t.trim());
  let query = terms.map(term => `"${term}"`).join(' OR ');
  
  if (clientName) {
    query += ` OR "${clientName}"`;
  }
  
  return query;
}

function formatMeltwaterData(data) {
  if (!data.documents) {
    return [];
  }

  return data.documents.map(doc => ({
    id: doc.id || `meltwater_${Date.now()}_${Math.random()}`,
    publication: doc.source?.name || doc.sourceName || 'Unknown',
    headline: doc.title || doc.headline || 'No title',
    link: doc.url || doc.link || '',
    reporter: doc.author || 'Unknown',
    timestamp: doc.publishedAt || doc.date || new Date().toISOString(),
    reach: doc.reach || 0,
    engagement: doc.engagement || 0,
    sentiment: doc.sentiment || 'neutral',
    content: doc.content || doc.summary || '',
    notes: ''
  }));
}

function formatMeltwaterDataForSheets(meltwaterData) {
  const headers = ['Publication', 'Headline', 'Link', 'Reporter', 'Timestamp', 'Reach', 'Sentiment', 'Notes'];
  const rows = meltwaterData.map(item => [
    item.publication,
    item.headline,
    item.link,
    item.reporter,
    new Date(item.timestamp).toLocaleString(),
    item.reach,
    item.sentiment,
    item.notes
  ]);
  
  return [headers, ...rows];
}

