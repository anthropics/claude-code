import { useState } from 'react';

/**
 * MCP-integrated image generation hook
 * 
 * This hook provides access to the Image Generation MCP tool
 * for creating AI-generated images.
 */
export function useMcpImageGeneration() {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generationId, setGenerationId] = useState(null);

  // Generate images based on a text prompt
  const generateImages = async (prompt, options = {}) => {
    if (!prompt || prompt.trim() === '') {
      setError('Image prompt is required');
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);

      const defaultOptions = {
        numberOfImages: 1,
        width: 1024,
        height: 1024,
        category: '', // Optional category for organizing images
        negativePrompt: '' // What to avoid in the image
      };

      const mergedOptions = { ...defaultOptions, ...options };
      
      // Call MCP imagen generate API
      const response = await fetch('/api/mcp/imagen/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          numberOfImages: mergedOptions.numberOfImages,
          width: mergedOptions.width,
          height: mergedOptions.height,
          category: mergedOptions.category,
          negativePrompt: mergedOptions.negativePrompt
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate images');
      }

      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setGenerationId(data.generationId);
        return data.images;
      } else {
        throw new Error('No images were generated');
      }
    } catch (err) {
      console.error('Error generating images:', err);
      setError('Failed to generate images');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Get images from a previous generation ID
  const getImagesById = async (id) => {
    if (!id) {
      setError('Generation ID is required');
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Call MCP imagen get API
      const response = await fetch(`/api/mcp/imagen/get/${id}`);

      if (!response.ok) {
        throw new Error('Failed to retrieve images');
      }

      const data = await response.json();
      
      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setGenerationId(id);
        return data.images;
      } else {
        throw new Error('No images found for this ID');
      }
    } catch (err) {
      console.error('Error retrieving images:', err);
      setError('Failed to retrieve images');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // List all previously generated images
  const listGeneratedImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call MCP imagen list API
      const response = await fetch('/api/mcp/imagen/list');

      if (!response.ok) {
        throw new Error('Failed to list generated images');
      }

      const data = await response.json();
      return data.generationHistory || [];
    } catch (err) {
      console.error('Error listing generated images:', err);
      setError('Failed to list generated images');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Create HTML for displaying images in a gallery
  const createGalleryHtml = async (imagePaths, options = {}) => {
    if (!imagePaths || !imagePaths.length) {
      setError('Image paths are required');
      return '';
    }

    try {
      setIsLoading(true);
      setError(null);

      const defaultOptions = {
        gallery: true,
        width: 512,
        height: 512
      };

      const mergedOptions = { ...defaultOptions, ...options };
      
      // Call MCP imagen HTML API
      const response = await fetch('/api/mcp/imagen/html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imagePaths,
          gallery: mergedOptions.gallery,
          width: mergedOptions.width,
          height: mergedOptions.height
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create gallery HTML');
      }

      const data = await response.json();
      return data.html || '';
    } catch (err) {
      console.error('Error creating gallery HTML:', err);
      setError('Failed to create gallery HTML');
      return '';
    } finally {
      setIsLoading(false);
    }
  };

  return {
    images,
    isLoading,
    error,
    generationId,
    generateImages,
    getImagesById,
    listGeneratedImages,
    createGalleryHtml
  };
}

export default useMcpImageGeneration;