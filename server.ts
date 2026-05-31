import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { MockProvider } from './src/server/routing/mockProvider';
import { GoogleRoutesProvider } from './src/server/routing/googleRoutesProvider';
import { RouteRequestPayload } from './src/types';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Developer note: 
  // We use MockProvider by default to not require API keys immediately.
  // Set to GoogleRoutesProvider and provide GOOGLE_MAPS_PLATFORM_KEY to call real API.
  const routeProvider = new MockProvider();
  // const routeProvider = new GoogleRoutesProvider();

  app.post('/api/compute-route', async (req, res) => {
    try {
      const payload = req.body as RouteRequestPayload;
      const result = await routeProvider.computeRoute(payload);
      res.json(result);
    } catch (error: any) {
      console.error('Route compute error:', error);
      res.status(500).json({ error: error.message || 'Error computing route' });
    }
  });

  app.post('/api/suggest-stops', async (req, res) => {
    try {
      const { origin, destination } = req.body;
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origin and destination are required' });
      }

      const prompt = `Give me a list of major transit cities/towns in Poland that a driver would naturally pass through when driving from "${origin.name}" (lat: ${origin.location.lat}, lng: ${origin.location.lng}) to "${destination.name}" (lat: ${destination.location.lat}, lng: ${destination.location.lng}).
Exclude the origin and destination themselves.
Provide 2 to 4 major cities/towns along the route, ordered from origin to destination. Ensure the coordinates (lat/lng) are accurate city-center coordinates in Poland.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description: 'Simple common city/town name, e.g., Łódź, Częstochowa, Toruń'
                },
                lat: {
                  type: Type.NUMBER,
                  description: 'Latitude of the city center'
                },
                lng: {
                  type: Type.NUMBER,
                  description: 'Longitude of the city center'
                },
                reason: {
                  type: Type.STRING,
                  description: 'Brief reason why this city is on this transit route e.g., Mid-point on A1 highway'
                }
              },
              required: ['name', 'lat', 'lng', 'reason']
            }
          }
        }
      });

      const responseText = response.text || '[]';
      const cities = JSON.parse(responseText.trim());
      res.json({ cities });
    } catch (error: any) {
      console.error('Suggest stops error:', error);
      res.status(500).json({ error: error.message || 'Error generating suggested stops' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
