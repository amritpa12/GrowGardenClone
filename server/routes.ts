import type { Express } from "express";
import { createServer, type Server } from "http";
import { mongoStorage } from "./mongodb-storage";
import { storage as memStorage } from "./storage";
import { databaseStorage } from "./database-storage";
import { initializeGridFS, getImageUrl, uploadItemImages } from "./image-storage";
import { getItemImageUrl } from "./image-service";
import { google } from 'googleapis';
import fs from 'fs';

// Auto-detect which storage to use based on MongoDB connection
let storage: any = memStorage;
let isUsingMongo = false;

async function initializeStorage() {
  try {
    await mongoStorage.init();
    console.log('✅ MongoDB Atlas connected successfully - using cloud database');
    storage = mongoStorage;
    isUsingMongo = true;

    // Initialize GridFS for image storage with better error handling
    setTimeout(async () => {
      try {
        initializeGridFS();
        console.log('✅ GridFS initialized for image storage');
      } catch (error) {
        console.log('⚠️  GridFS initialization failed, will retry in 5 seconds...');
        setTimeout(() => {
          try {
            initializeGridFS();
            console.log('✅ GridFS initialized for image storage');
          } catch (retryError) {
            console.log('GridFS initialization failed after retry, continuing without image storage');
          }
        }, 5000);
      }
    }, 2000);
  } catch (error) {
    console.log('⚠️  MongoDB Atlas connection failed - using local memory storage');
    console.log('   Error:', error.message);
    storage = memStorage;
    isUsingMongo = false;
  }
}

// Initialize storage on startup
initializeStorage();
import { insertTradingItemSchema, insertTradeAdSchema, insertChatMessageSchema } from "@shared/schema";
import { proxyImage } from './image-proxy';

export async function registerRoutes(app: Express): Promise<Server> {
  // Comprehensive OAuth diagnostic endpoint
  app.get('/api/oauth-diagnostic', async (req, res) => {
    try {
      const clientId = process.env.ROBLOX_CLIENT_ID;
      const clientSecret = process.env.ROBLOX_CLIENT_SECRET;

      const results: any = {
        timestamp: new Date().toISOString(),
        credentials: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          clientIdLength: clientId?.length || 0,
          clientIdMasked: clientId ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}` : 'missing'
        },
        tests: {}
      };

      if (!clientId) {
        return res.json({ ...results, error: 'Client ID missing' });
      }

      // Test 1: Authorization endpoint
      const authUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost:5000/auth/callback&scope=openid+profile&state=test`;

      try {
        const authResponse = await fetch(authUrl, { method: 'HEAD' });
        results.tests.authorization = {
          url: authUrl,
          status: authResponse.status,
          statusText: authResponse.statusText,
          headers: Object.fromEntries(authResponse.headers.entries()),
          working: authResponse.status === 200
        };
      } catch (error) {
        results.tests.authorization = { error: error instanceof Error ? error.message : String(error) };
      }

      // Test 2: Try different scope format
      const authUrl2 = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Fauth%2Fcallback&scope=openid%20profile&state=test`;

      try {
        const authResponse2 = await fetch(authUrl2, { method: 'HEAD' });
        results.tests.authorizationEncoded = {
          status: authResponse2.status,
          working: authResponse2.status === 200
        };
      } catch (error) {
        results.tests.authorizationEncoded = { error: error instanceof Error ? error.message : String(error) };
      }

      // Test 3: Token endpoint (should return 400 without proper params, not 404)
      try {
        const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'grant_type=authorization_code'
        });

        results.tests.tokenEndpoint = {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          endpointExists: tokenResponse.status !== 404
        };
      } catch (error) {
        results.tests.tokenEndpoint = { error: error instanceof Error ? error.message : String(error) };
      }

      // Analysis
      results.analysis = {
        likely_issues: [],
        recommendations: []
      };

      if (results.tests.authorization?.status === 404) {
        results.analysis.likely_issues.push('OAuth application not published or active');
        results.analysis.recommendations.push('Check application status in Creator Dashboard');
      }

      if (results.tests.authorization?.status === 400) {
        results.analysis.likely_issues.push('Invalid redirect URI or parameters');
        results.analysis.recommendations.push('Verify redirect URI matches exactly');
      }

      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Diagnostic failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Trading Items API
  app.get("/api/trading-items", async (req, res) => {
    try {
      const items = await storage.getAllTradingItems();
      // Only return tradeable items
      const tradeableItems = items.filter((item: any) => item.tradeable !== false);
      res.json(tradeableItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trading items" });
    }
  });

  app.get("/api/trading-items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = await storage.getTradingItem(id);
      if (!item) {
        return res.status(404).json({ message: "Trading item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trading item" });
    }
  });

  app.post("/api/trading-items", async (req, res) => {
    try {
      const validatedData = insertTradingItemSchema.parse(req.body);
      const item = await storage.createTradingItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid trading item data" });
    }
  });

  // Trade Ads API
  app.get("/api/trade-ads", async (req, res) => {
    try {
      const ads = await databaseStorage.getAllTradeAds();
      res.json(ads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trade ads" });
    }
  });

  app.post("/api/trade-ads", async (req, res) => {
    try {
      // Get user info from request headers (since we're using localStorage auth)
      const userDataHeader = req.headers['x-user-data'] as string;

      if (!userDataHeader) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let userData;
      try {
        userData = JSON.parse(userDataHeader);
      } catch {
        return res.status(400).json({ error: "Invalid user data" });
      }

      // Validate the trade ad data
      const validatedData = insertTradeAdSchema.parse({
        ...req.body,
        userId: userData.id.toString() // Ensure userId comes from authenticated user
      });

      console.log('Creating trade ad for user:', userData.username, 'with ID:', userData.id);

      const ad = await databaseStorage.createTradeAd(validatedData);
      res.status(201).json(ad);
    } catch (error) {
      console.error('Trade ad creation error:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid trade ad data", details: (error as any).errors });
      } else {
        res.status(500).json({ error: "Failed to create trade ad" });
      }
    }
  });

  // Get current user's trade ads
  app.get("/api/trade-ads/my-ads", async (req, res) => {
    try {
      // For now, get user info from localStorage simulation via header
      const userDataHeader = req.headers['x-user-data'] as string;

      if (!userDataHeader) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let userData;
      try {
        userData = JSON.parse(userDataHeader);
      } catch {
        return res.status(400).json({ error: "Invalid user data" });
      }

      const allTradeAds = await databaseStorage.getAllTradeAds();
      // Filter trade ads by user ID or username
      const userTradeAds = allTradeAds.filter(ad => 
        ad.userId === userData.id?.toString() || 
        ad.userId === userData.username
      );

      res.json(userTradeAds);
    } catch (error) {
      console.error("Error fetching user trade ads:", error);
      res.status(500).json({ error: "Failed to fetch user trade ads" });
    }
  });

  // Delete a trade ad
  app.delete("/api/trade-ads/:id", async (req, res) => {
    try {
      const adId = parseInt(req.params.id);
      const userDataHeader = req.headers['x-user-data'] as string;

      if (!userDataHeader) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let userData;
      try {
        userData = JSON.parse(userDataHeader);
      } catch {
        return res.status(400).json({ error: "Invalid user data" });
      }

      // Get the trade ad to verify ownership
      const tradeAd = await storage.getTradeAd(adId);
      if (!tradeAd) {
        return res.status(404).json({ error: "Trade ad not found" });
      }

      // Check if user owns this trade ad
      if (tradeAd.userId !== userData.id?.toString() && tradeAd.userId !== userData.username) {
        return res.status(403).json({ error: "Not authorized to delete this trade ad" });
      }

      // Update status to cancelled instead of hard delete
      await storage.updateTradeAdStatus(adId, 'cancelled');

      res.json({ message: "Trade ad deleted successfully" });
    } catch (error) {
      console.error("Error deleting trade ad:", error);
      res.status(500).json({ error: "Failed to delete trade ad" });
    }
  });

  // Image proxy route to handle CORS issues with PostImg
  app.get("/api/image-proxy", proxyImage);

  // GridFS image serving endpoint
  app.get('/api/images/:imageId', async (req, res) => {
    try {
      const { imageId } = req.params;
      const imageBuffer = await getImageUrl(imageId);
      
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      
      res.send(imageBuffer);
    } catch (error) {
      res.status(404).json({ message: "Image not found" });
    }
  });

  // Chat Messages API
  app.get("/api/chat-messages/:tradeAdId", async (req, res) => {
    try {
      const tradeAdId = parseInt(req.params.tradeAdId);
      const messages = await storage.getChatMessagesByTradeAd(tradeAdId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat-messages", async (req, res) => {
    try {
      const validatedData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid chat message data" });
    }
  });

  // Community Stats API
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getCommunityStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch community stats" });
    }
  });

  // Weather API
  app.get("/api/weather", async (req, res) => {
    try {
      const weather = await storage.getCurrentWeather();
      res.json(weather);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weather data" });
    }
  });

  // Roblox OAuth endpoints
  app.post("/api/auth/roblox/callback", async (req, res) => {
    try {
      const { code, state } = req.body;

      console.log('=== OAuth Callback Received ===');
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Code present:', !!code);
      console.log('State present:', !!state);
      console.log('===============================');

      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }

      // Exchange code for access token - match the deployed URL exactly
      const redirectUri = req.headers.host?.includes('replit.app') 
        ? `https://${req.headers.host}/auth/callback`
        : 'https://grow-garden-clone-awsaccamr1989.replit.app/auth/callback';

      console.log('OAuth token exchange details:', {
        clientId: process.env.ROBLOX_CLIENT_ID,
        clientSecret: process.env.ROBLOX_CLIENT_SECRET ? 'SET' : 'MISSING',
        redirectUri,
        codeLength: code.length,
        host: req.headers.host,
        origin: req.headers.origin
      });

      // Prepare token exchange parameters
      const tokenParams = new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID || '',
        client_secret: process.env.ROBLOX_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      });

      console.log('Token exchange params:', {
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET ? '[REDACTED]' : 'MISSING',
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_length: code.length
      });

      const tokenResponse = await fetch('https://apis.roblox.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorText,
          redirectUri: redirectUri,
          timestamp: new Date().toISOString()
        });

        // Try to parse JSON error response
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
          console.log('Parsed error details:', errorDetails);
        } catch {
          console.log('Raw error text:', errorText);
          errorDetails = { error: errorText };
        }

        // Handle specific OAuth errors
        if (errorText.includes('authorization_expired') || errorText.includes('invalid_grant') || 
            errorText.includes('expired') || tokenResponse.status === 400) {
          return res.status(400).json({ 
            error: "Authorization code expired",
            message: "Please try signing in again - the authorization code has expired",
            details: errorDetails
          });
        }

        return res.status(400).json({ 
          error: "Failed to exchange authorization code",
          message: "Token exchange failed with Roblox servers",
          details: errorDetails,
          status: tokenResponse.status
        });
      }

      const tokenData = await tokenResponse.json();

      // Get user info using access token
      const userResponse = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (!userResponse.ok) {
        console.error('User info fetch failed:', await userResponse.text());
        return res.status(400).json({ error: "Failed to get user information" });
      }

      const userData = await userResponse.json();

      // Get profile picture from Roblox API
      let profileImageUrl = `https://ui-avatars.com/api/?name=${userData.preferred_username}&background=8b5cf6&color=fff&size=150`;

      try {
        const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userData.sub}&size=150x150&format=Png&isCircular=false`);
        if (avatarResponse.ok) {
          const avatarData = await avatarResponse.json();
          if (avatarData.data && avatarData.data[0] && avatarData.data[0].imageUrl) {
            // Use our image proxy to handle CORS for Roblox images
            const robloxImageUrl = avatarData.data[0].imageUrl;
            profileImageUrl = `/api/image-proxy?url=${encodeURIComponent(robloxImageUrl)}`;
            console.log('Using proxied Roblox avatar:', profileImageUrl);
          }
        }
      } catch (avatarError) {
        console.log('Avatar fetch failed, using fallback:', avatarError);
      }

      // Create or update user in PostgreSQL database
      const robloxUser = {
        id: parseInt(userData.sub),
        username: userData.preferred_username,
        displayName: userData.name || userData.preferred_username,
        profileImageUrl: profileImageUrl
      };

      // Store user in PostgreSQL using upsert (insert or update)
      try {
        console.log('Storing user in PostgreSQL:', robloxUser.username);

        // Store in PostgreSQL database
        await databaseStorage.upsertUser({
          id: userData.sub, // Roblox user ID as string
          username: robloxUser.username,
          email: null, // Roblox OAuth doesn't provide email
          firstName: null,
          lastName: null,
          profileImageUrl: profileImageUrl
        });

        console.log('User stored successfully in PostgreSQL');
      } catch (dbError) {
        console.log('Database error storing user:', dbError);
      }

      res.json(robloxUser);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Test avatar fetching endpoint
  app.get("/api/test/avatar/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      console.log('Testing avatar fetch for user:', userId);

      const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
      console.log('Roblox API response status:', avatarResponse.status);

      if (avatarResponse.ok) {
        const avatarData = await avatarResponse.json();
        console.log('Avatar data received:', avatarData);

        if (avatarData.data && avatarData.data[0] && avatarData.data[0].imageUrl) {
          const imageUrl = avatarData.data[0].imageUrl;
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;

          res.json({
            success: true,
            originalUrl: imageUrl,
            proxyUrl: proxyUrl,
            fullProxyUrl: `${req.protocol}://${req.headers.host}${proxyUrl}`
          });
        } else {
          res.json({ success: false, error: 'No image data in response', data: avatarData });
        }
      } else {
        const errorText = await avatarResponse.text();
        res.json({ success: false, error: 'Failed to fetch from Roblox', status: avatarResponse.status, errorText });
      }
    } catch (error) {
      console.error('Avatar test error:', error);
      res.status(500).json({ error: 'Test failed', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Get current user info (placeholder - would need session management)
  app.get("/api/auth/user", async (req, res) => {
    res.json({ user: null }); // Would implement session-based auth here
  });

  // Debug endpoint to test OAuth callback
  app.get("/api/debug/oauth", async (req, res) => {
    const clientId = process.env.ROBLOX_CLIENT_ID;
    const clientSecret = process.env.ROBLOX_CLIENT_SECRET;

    res.json({
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      host: req.headers.host,
      origin: req.headers.origin
    });
  });

  // Database viewer endpoint
  app.get("/api/debug/database", async (req, res) => {
    try {
      const [tradingItems, tradeAds] = await Promise.all([
        storage.getAllTradingItems(),
        storage.getAllTradeAds()
      ]);

      res.json({
        tradingItems: {
          count: tradingItems.length,
          sample: tradingItems.slice(0, 5)
        },
        tradeAds: {
          count: tradeAds.length,
          data: tradeAds
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch database data", details: error instanceof Error ? error.message : String(error) });
    }
  });
  // ===== STOCK API ENDPOINTS =====
  // Get live stock data - placeholder endpoint
  app.get('/api/stock', async (req, res) => {
    res.json({
      seedsStock: [],
      gearStock: [],
      eggStock: [],
      honeyStock: [],
      cosmeticsStock: [],
      lastSeen: { Seeds: [], Gears: [], Eggs: [] },
      restockTimers: {},
      timerCalculatedAt: Date.now(),
      imageData: {}
    });
  });

  // Get value list data from Google Sheets
  app.get('/api/value-list', async (req, res) => {
    try {
      const VAL_SHEET_ID = process.env.VAL_SHEET_ID;
      const serviceAccountKeyPath = process.env.GSERVICE_ACCOUNT_KEY;

      console.log('Debug - VAL_SHEET_ID:', VAL_SHEET_ID);
      console.log('Debug - serviceAccountKeyPath:', serviceAccountKeyPath);

      if (!VAL_SHEET_ID) {
        throw new Error('VAL_SHEET_ID environment variable not set');
      }

      if (!serviceAccountKeyPath || !fs.existsSync(serviceAccountKeyPath)) {
        throw new Error('Google service account key not found');
      }

      // Initialize Google Sheets client
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));

      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      const range = 'A:N'; // Columns A through N to get all data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: VAL_SHEET_ID,
        range: range,
      });

      const rows = response.data.values || [];

      if (rows.length === 0) {
        return res.json([]);
      }

      // Skip header row and map data to objects
      const headers = rows[0];
      const valueListItems = rows.slice(1).map((row: any[], index: number) => {
        const item: any = {};
        headers.forEach((header: string, i: number) => {
          const key = header.toLowerCase().replace(/\s+/g, '');
          let value = row[i] || '';

          // Convert specific fields to appropriate types
          if (key === 'age' || key === 'position' || key === 'itemid') {
            value = parseInt(value) || 0;
          } else if (key === 'updatetime') {
            value = parseInt(value) || Date.now() / 1000;
          }

          // Map column names to camelCase
          const mappedKey = {
            'category': 'category',
            'pets': 'pets',
            'age': 'age',
            'weight': 'weight',
            'value': 'value',
            'demand': 'demand',
            'trend': 'trend',
            'rarity': 'rarity',
            'origin': 'origin',
            'hatch%': 'hatchPercent',
            'image': 'image',
            'updatetime': 'updateTime',
            'valuehistory': 'valueHistory',
            'itemid': 'itemId',
            'position': 'position'
          }[key] || key;

          item[mappedKey] = value;
        });

        return item;
      });

      res.json(valueListItems);
    } catch (error) {
      console.error('Failed to fetch value list data:', error);
      res.status(500).json({ error: 'Failed to fetch value list data' });
    }
  });

  // Get item image URL with fallback
  app.get('/api/item-image/:itemName', async (req, res) => {
    try {
      const { itemName } = req.params;
      const itemType = req.query.type as string || 'item';
      const imageUrl = getItemImageUrl(decodeURIComponent(itemName), itemType);
      res.json({ imageUrl });
    } catch (error) {
      console.error('Failed to get item image:', error);
      res.status(500).json({ error: 'Failed to get item image' });
    }
  });

  // ===== ADMIN ENDPOINTS =====
  // Clear cache endpoint - placeholder
  app.post('/api/admin/clear-cache', async (req, res) => {
    try {
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear cache' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}