// Meltwater webhook handler for real-time media monitoring

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Meltwater-Signature');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature (if configured)
    const signature = req.headers['x-meltwater-signature'];
    if (process.env.MELTWATER_WEBHOOK_SECRET && signature) {
      const isValid = verifyMeltwaterSignature(req.body, signature, process.env.MELTWATER_WEBHOOK_SECRET);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Process Meltwater webhook data
    const meltwaterData = req.body;
    
    // Transform Meltwater data to our standard format
    const processedData = processMeltwaterWebhook(meltwaterData);
    
    // Store or forward the data (you might want to save to database or forward to Google Sheets)
    console.log('Meltwater webhook received:', processedData);
    
    // Respond to Meltwater that we received the webhook
    res.status(200).json({ 
      success: true, 
      message: 'Webhook processed successfully',
      itemsProcessed: processedData.length 
    });

  } catch (error) {
    console.error('Meltwater webhook error:', error);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message 
    });
  }
}

// Verify Meltwater webhook signature
function verifyMeltwaterSignature(payload, signature, secret) {
  // Note: In a real implementation, you'd need to import crypto
  // For now, this is a placeholder that always returns true
  // You would need: import crypto from 'crypto';
  
  try {
    // const expectedSignature = crypto
    //   .createHmac('sha256', secret)
    //   .update(JSON.stringify(payload))
    //   .digest('hex');
    // return signature === `sha256=${expectedSignature}`;
    
    // Placeholder - always return true for now
    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Process Meltwater webhook data
function processMeltwaterWebhook(data) {
  const processedItems = [];
  
  // Handle different Meltwater data structures
  if (data.documents && Array.isArray(data.documents)) {
    data.documents.forEach(doc => {
      const processedItem = {
        id: doc.id || `meltwater_${Date.now()}_${Math.random()}`,
        source: 'meltwater',
        type: doc.mediaType || 'unknown',
        title: doc.title || doc.headline || 'No title',
        content: doc.content || doc.summary || '',
        url: doc.url || doc.link || '',
        publication: doc.source?.name || doc.sourceName || 'Unknown',
        author: doc.author || 'Unknown',
        publishedAt: doc.publishedAt || doc.date || new Date().toISOString(),
        reach: doc.reach || 0,
        engagement: doc.engagement || 0,
        sentiment: doc.sentiment || 'neutral',
        language: doc.language || 'en',
        country: doc.country || 'unknown',
        tags: doc.tags || [],
        mentions: doc.mentions || []
      };
      
      processedItems.push(processedItem);
    });
  }
  
  return processedItems;
}
module.exports.config = { runtime: 'nodejs20.x' };

