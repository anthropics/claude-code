import React, { useState } from 'react';
import { useMcpImageGeneration } from "./../hooks/mcp";

/**
 * MCP Image Generation Demo
 * 
 * This component demonstrates how to use the useMcpImageGeneration hook
 * for generating images using the MCP Image Generation tool.
 */
function McpImageDemo() {
  const [prompt, setPrompt] = useState('');
  const [imageCount, setImageCount] = useState(1);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [htmlGallery, setHtmlGallery] = useState('');
  
  const {
    images,
    isLoading,
    error,
    generationId,
    generateImages,
    getImagesById,
    listGeneratedImages,
    createGalleryHtml
  } = useMcpImageGeneration();

  // Handle image generation submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    const generatedImages = await generateImages(prompt, {
      numberOfImages: imageCount,
      negativePrompt: negativePrompt
    });
    
    if (generatedImages.length > 0) {
      const html = await createGalleryHtml(generatedImages.map(img => img.url));
      setHtmlGallery(html);
    }
  };

  // Handle loading previous generations
  const handleLoadPrevious = async () => {
    const history = await listGeneratedImages();
    if (history.length > 0) {
      const previousId = history[0].id; // Get most recent
      await getImagesById(previousId);
      
      if (images.length > 0) {
        const html = await createGalleryHtml(images.map(img => img.url));
        setHtmlGallery(html);
      }
    }
  };

  return (
    <div className="mcp-image-demo">
      <h2>Image Generation with MCP</h2>
      
      <form onSubmit={handleSubmit} className="image-form">
        <div className="form-group">
          <label htmlFor="prompt">Image Description:</label>
          <textarea 
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            rows={3}
            required
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="imageCount">Number of Images:</label>
            <select 
              id="imageCount"
              value={imageCount}
              onChange={(e) => setImageCount(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="negativePrompt">Negative Prompt (Optional):</label>
            <input 
              type="text"
              id="negativePrompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Elements to avoid in the image..."
            />
          </div>
        </div>
        
        <div className="button-group">
          <button type="submit" disabled={isLoading} className="generate-button">
            {isLoading ? 'Generating...' : 'Generate Images'}
          </button>
          
          <button 
            type="button" 
            onClick={handleLoadPrevious}
            disabled={isLoading}
            className="previous-button"
          >
            Load Previous Generation
          </button>
        </div>
      </form>
      
      {error && (
        <div className="error-message">Error: {error}</div>
      )}
      
      {images.length > 0 && (
        <div className="images-container">
          <h3>Generated Images</h3>
          <div className="generation-info">
            Generation ID: {generationId}
          </div>
          
          <div className="image-gallery">
            {images.map((image, index) => (
              <div key={index} className="image-item">
                <img 
                  src={image.url} 
                  alt={`Generated image ${index + 1}`}
                  loading="lazy"
                />
                <div className="image-caption">Image {index + 1}</div>
              </div>
            ))}
          </div>
          
          {htmlGallery && (
            <div className="html-gallery">
              <h4>Gallery HTML Code</h4>
              <pre>{htmlGallery}</pre>
            </div>
          )}
        </div>
      )}
      
      <style jsx>{`
        .mcp-image-demo {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .image-form {
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-row {
          display: flex;
          gap: 15px;
        }
        
        .form-row .form-group {
          flex: 1;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        
        textarea, input[type="text"] {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
        }
        
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
          background-color: white;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
        }
        
        button {
          padding: 10px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        
        .generate-button {
          background-color: #0070f3;
          color: white;
        }
        
        .previous-button {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ccc;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #d32f2f;
          margin: 10px 0;
          padding: 10px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        .images-container {
          margin-top: 30px;
        }
        
        .generation-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 15px;
        }
        
        .image-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .image-item {
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          background-color: #f9f9f9;
        }
        
        .image-item img {
          width: 100%;
          height: auto;
          display: block;
        }
        
        .image-caption {
          padding: 10px;
          text-align: center;
          font-size: 14px;
          color: #555;
        }
        
        .html-gallery {
          margin-top: 20px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 4px;
          overflow: auto;
        }
        
        .html-gallery pre {
          margin: 0;
          font-size: 14px;
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}

export default McpImageDemo;