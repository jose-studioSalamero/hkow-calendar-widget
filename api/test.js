const { google } = require('googleapis');

export default async function handler(req, res) {
  try {
    // Check if env variable exists
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return res.status(500).json({ error: 'Missing GOOGLE_SERVICE_ACCOUNT_KEY' });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    
    // Check credentials format
    if (!credentials.client_email || !credentials.private_key) {
      return res.status(500).json({ error: 'Invalid credentials format' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Try to fetch just one cell
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: '1fymh7kY8cme4rYP3Tb7g1YzzxnJI2pc9o9dXHTPCGfU',
      range: 'Untitled!A1',
    });

    res.status(200).json({ 
      success: true, 
      data: response.data,
      email: credentials.client_email 
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}