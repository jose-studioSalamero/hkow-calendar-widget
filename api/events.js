const { google } = require('googleapis');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const spreadsheetId = '1fymh7kY8cme4rYP3Tb7g1YzzxnJI2pc9o9dXHTPCGfU';
    
    const response = await Promise.race([
      sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: 'Untitled!A2:N1000',
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      )
    ]);

    const rows = response.data.values || [];
    
    const events = rows
      .filter(row => row[2] === 'Hong Kong Observation Wheel' && row[3] === 'live')
      .map(row => {
        const startDateTime = new Date(row[5]);
        const endDateTime = new Date(row[6]);
        
        return {
          id: row[0],
          eventbriteId: row[0],
          title: row[2],
          date: row[5]?.split('T')[0],
          endDate: row[6]?.split('T')[0],
          startTime: startDateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Hong_Kong'
          }),
          endTime: endDateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Hong_Kong'
          }),
          description: row[9] || '',
          imageUrl: row[10] || '',
          ticketUrl: row[11] || '',
          detailsUrl: row[11] || '',
          isFree: row[12] === 'TRUE',
        };
      });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(events);
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch events',
      message: error.message 
    });
  }
}