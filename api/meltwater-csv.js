// Meltwater CSV processing endpoint

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
    const { csvData, config } = req.body;

    if (!csvData) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    // Parse CSV data
    const parsedData = parseCSV(csvData);
    
    // Filter and process Meltwater data
    const processedData = processMeltwaterCSV(parsedData, config);
    
    // Update Google Sheets if configured
    if (config.googleSheetsId && config.googleApiKey && processedData.length > 0) {
      await updateSheetsWithMeltwaterData(config, processedData);
    }

    return res.status(200).json({
      success: true,
      data: processedData,
      totalItems: processedData.length,
      message: 'CSV processed successfully'
    });

  } catch (error) {
    console.error('Meltwater CSV processing error:', error);
    return res.status(500).json({ 
      error: 'CSV processing failed',
      message: error.message 
    });
  }
}

// Parse CSV data
function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }
  
  return data;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Process Meltwater CSV data
function processMeltwaterCSV(data, config) {
  return data.map(row => {
    // Map common Meltwater CSV columns to our format
    const item = {
      id: row.ID || row.id || `meltwater_csv_${Date.now()}_${Math.random()}`,
      source: 'meltwater_csv',
      type: determineMediaType(row),
      title: row.Title || row.Headline || row.title || 'No title',
      content: row.Content || row.Summary || row.content || '',
      url: row.URL || row.Link || row.url || '',
      publication: row.Source || row.Publication || row.source || 'Unknown',
      author: row.Author || row.Reporter || row.author || 'Unknown',
      publishedAt: parseDate(row.Date || row['Published Date'] || row.publishedAt),
      reach: parseInt(row.Reach || row.reach || '0'),
      engagement: parseInt(row.Engagement || row.engagement || '0'),
      sentiment: row.Sentiment || row.sentiment || 'neutral',
      language: row.Language || row.language || 'en',
      country: row.Country || row.country || 'unknown',
      tags: parseArray(row.Tags || row.tags || ''),
      mentions: parseArray(row.Mentions || row.mentions || ''),
      notes: ''
    };
    
    return item;
  }).filter(item => {
    // Filter based on search terms if provided
    if (config.searchTerms) {
      const terms = config.searchTerms.toLowerCase().split(',').map(t => t.trim());
      const searchText = `${item.title} ${item.content}`.toLowerCase();
      return terms.some(term => searchText.includes(term));
    }
    return true;
  });
}

// Determine media type from row data
function determineMediaType(row) {
  const source = (row.Source || row.source || '').toLowerCase();
  const mediaType = (row['Media Type'] || row.mediaType || '').toLowerCase();
  
  if (mediaType.includes('social') || source.includes('twitter') || source.includes('facebook')) {
    return 'social';
  } else if (mediaType.includes('news') || mediaType.includes('print')) {
    return 'news';
  } else if (mediaType.includes('blog')) {
    return 'blog';
  } else {
    return 'unknown';
  }
}

// Parse date string to ISO format
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Parse comma-separated array
function parseArray(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(s => s);
}

// Update Google Sheets with Meltwater data
async function updateSheetsWithMeltwaterData(config, data) {
  const headers = ['Publication', 'Headline', 'Link', 'Author', 'Date', 'Reach', 'Sentiment', 'Notes'];
  const rows = data.map(item => [
    item.publication,
    item.title,
    item.url,
    item.author,
    new Date(item.publishedAt).toLocaleString(),
    item.reach,
    item.sentiment,
    item.notes
  ]);
  
  const sheetData = [headers, ...rows];
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheetsId}/values/Meltwater!A1:H${sheetData.length}?valueInputOption=USER_ENTERED&key=${config.googleApiKey}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: sheetData
    })
  });
  
  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}
handler.config = { runtime: 'nodejs20.x' };


