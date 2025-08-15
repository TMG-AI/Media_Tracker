// API utilities for media tracking integrations

// Twitter/X API integration
export class TwitterAPI {
  constructor(bearerToken) {
    this.bearerToken = bearerToken;
    this.baseUrl = 'https://api.twitter.com/2';
  }

  async searchTweets(query, maxResults = 50) {
    if (!this.bearerToken) {
      throw new Error('Twitter Bearer Token is required');
    }

    const params = new URLSearchParams({
      query: query,
      max_results: maxResults,
      'tweet.fields': 'public_metrics,created_at,author_id',
      'user.fields': 'public_metrics,username,name',
      'expansions': 'author_id'
    });

    try {
      const response = await fetch(`${this.baseUrl}/tweets/search/recent?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.formatTwitterData(data);
    } catch (error) {
      console.error('Twitter API error:', error);
      throw error;
    }
  }

  formatTwitterData(data) {
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
}

// Google News API integration
export class GoogleNewsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://newsapi.org/v2';
  }

  async searchNews(query, pageSize = 20) {
    if (!this.apiKey) {
      throw new Error('Google News API key is required');
    }

    const params = new URLSearchParams({
      q: query,
      apiKey: this.apiKey,
      pageSize: pageSize,
      sortBy: 'publishedAt',
      language: 'en'
    });

    try {
      const response = await fetch(`${this.baseUrl}/everything?${params}`);
      
      if (!response.ok) {
        throw new Error(`News API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.formatNewsData(data);
    } catch (error) {
      console.error('News API error:', error);
      throw error;
    }
  }

  formatNewsData(data) {
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
}

// Google Sheets API integration
export class GoogleSheetsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  async updateSheet(spreadsheetId, range, values) {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key is required');
    }

    const url = `${this.baseUrl}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED&key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: values
        })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Google Sheets API error:', error);
      throw error;
    }
  }

  async appendToSheet(spreadsheetId, range, values) {
    if (!this.apiKey) {
      throw new Error('Google Sheets API key is required');
    }

    const url = `${this.baseUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: values
        })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Google Sheets API error:', error);
      throw error;
    }
  }

  formatTwitterDataForSheets(twitterData) {
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

  formatNewsDataForSheets(newsData) {
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
}

// Main data collection orchestrator
export class MediaTracker {
  constructor(config) {
    this.config = config;
    this.twitterAPI = new TwitterAPI(config.twitterBearerToken);
    this.newsAPI = new GoogleNewsAPI(config.googleApiKey);
    this.sheetsAPI = new GoogleSheetsAPI(config.googleApiKey);
  }

  async collectAllData(progressCallback) {
    const results = {
      twitter: [],
      news: [],
      errors: []
    };

    try {
      // Collect Twitter data
      if (progressCallback) progressCallback(20, 'Collecting Twitter data...');
      
      if (this.config.twitterBearerToken && this.config.searchTerms) {
        try {
          const twitterQuery = this.buildTwitterQuery(this.config.searchTerms, this.config.clientName);
          results.twitter = await this.twitterAPI.searchTweets(twitterQuery);
        } catch (error) {
          results.errors.push(`Twitter: ${error.message}`);
        }
      }

      // Collect News data
      if (progressCallback) progressCallback(50, 'Collecting news articles...');
      
      if (this.config.googleApiKey && this.config.searchTerms) {
        try {
          const newsQuery = this.buildNewsQuery(this.config.searchTerms, this.config.clientName);
          results.news = await this.newsAPI.searchNews(newsQuery);
        } catch (error) {
          results.errors.push(`News: ${error.message}`);
        }
      }

      // Update Google Sheets
      if (progressCallback) progressCallback(80, 'Updating Google Sheets...');
      
      if (this.config.googleSheetsId && this.config.googleApiKey) {
        try {
          await this.updateGoogleSheets(results.twitter, results.news);
        } catch (error) {
          results.errors.push(`Sheets: ${error.message}`);
        }
      }

      if (progressCallback) progressCallback(100, 'Collection complete!');
      
      return results;
    } catch (error) {
      results.errors.push(`General: ${error.message}`);
      return results;
    }
  }

  buildTwitterQuery(searchTerms, clientName) {
    const terms = searchTerms.split(',').map(t => t.trim());
    const queries = terms.map(term => `"${term}"`);
    
    if (clientName) {
      queries.push(`"${clientName}"`);
    }
    
    return queries.join(' OR ') + ' -is:retweet lang:en';
  }

  buildNewsQuery(searchTerms, clientName) {
    const terms = searchTerms.split(',').map(t => t.trim());
    let query = terms.join(' OR ');
    
    if (clientName) {
      query += ` OR "${clientName}"`;
    }
    
    return query;
  }

  async updateGoogleSheets(twitterData, newsData) {
    if (!this.config.googleSheetsId) {
      throw new Error('Google Sheets ID is required');
    }

    const promises = [];

    // Update Twitter sheet
    if (twitterData.length > 0) {
      const twitterSheetData = this.sheetsAPI.formatTwitterDataForSheets(twitterData);
      promises.push(
        this.sheetsAPI.updateSheet(
          this.config.googleSheetsId,
          'Twitter!A1:F' + (twitterSheetData.length),
          twitterSheetData
        )
      );
    }

    // Update News sheet
    if (newsData.length > 0) {
      const newsSheetData = this.sheetsAPI.formatNewsDataForSheets(newsData);
      promises.push(
        this.sheetsAPI.updateSheet(
          this.config.googleSheetsId,
          'News!A1:F' + (newsSheetData.length),
          newsSheetData
        )
      );
    }

    await Promise.all(promises);
  }
}

// Utility functions
export const validateConfig = (config) => {
  const errors = [];
  
  if (!config.clientName) {
    errors.push('Client name is required');
  }
  
  if (!config.searchTerms) {
    errors.push('Search terms are required');
  }
  
  if (!config.twitterBearerToken && !config.googleApiKey) {
    errors.push('At least one API key (Twitter or Google) is required');
  }
  
  return errors;
};

export const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const timeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};
