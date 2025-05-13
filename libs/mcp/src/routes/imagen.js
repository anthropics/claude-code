/**
 * Image Generation API Routes
 * 
 * These routes provide an interface between the MCP image generation hook
 * and the MCP image generation server.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../../logging/logger').createLogger('imagen-api');

// MCP image generation server configuration
const MCP_IMAGEN_URL = process.env.MCP_IMAGEN_URL || 'http://localhost:3002';

// Generate images
router.post('/generate', async (req, res) => {
  try {
    const { 
      prompt, 
      numberOfImages = 1, 
      width = 1024, 
      height = 1024, 
      category = '',
      negativePrompt = ''
    } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Image prompt is required' });
    }
    
    // Call MCP image generation server
    const response = await axios.post(`${MCP_IMAGEN_URL}/generate`, {
      prompt,
      numberOfImages,
      width,
      height,
      category,
      negativePrompt
    });
    
    logger.debug('Generated images', { 
      promptPrefix: prompt.substring(0, 50),
      count: numberOfImages
    });
    
    return res.json({
      images: response.data.images || [],
      generationId: response.data.generationId
    });
  } catch (error) {
    logger.error('Error generating images', { error: error.message });
    return res.status(500).json({ error: 'Failed to generate images' });
  }
});

// Get images by ID
router.get('/get/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Generation ID is required' });
    }
    
    // Call MCP image generation server
    const response = await axios.get(`${MCP_IMAGEN_URL}/get/${id}`);
    
    logger.debug('Retrieved images by ID', { id });
    return res.json({
      images: response.data.images || [],
      generationId: id
    });
  } catch (error) {
    logger.error('Error retrieving images', { error: error.message });
    return res.status(500).json({ error: 'Failed to retrieve images' });
  }
});

// List all generated images
router.get('/list', async (req, res) => {
  try {
    // Call MCP image generation server
    const response = await axios.get(`${MCP_IMAGEN_URL}/list`);
    
    logger.debug('Listed all generations');
    return res.json({
      generationHistory: response.data.generationHistory || []
    });
  } catch (error) {
    logger.error('Error listing generations', { error: error.message });
    return res.status(500).json({ error: 'Failed to list generations' });
  }
});

// Create gallery HTML
router.post('/html', async (req, res) => {
  try {
    const { 
      imagePaths, 
      gallery = true, 
      width = 512, 
      height = 512 
    } = req.body;
    
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
      return res.status(400).json({ error: 'Image paths are required' });
    }
    
    // Call MCP image generation server
    const response = await axios.post(`${MCP_IMAGEN_URL}/create-html`, {
      imagePaths,
      gallery,
      width,
      height
    });
    
    logger.debug('Created gallery HTML', { imageCount: imagePaths.length });
    return res.json({
      html: response.data.html || ''
    });
  } catch (error) {
    logger.error('Error creating gallery HTML', { error: error.message });
    return res.status(500).json({ error: 'Failed to create gallery HTML' });
  }
});

module.exports = router;