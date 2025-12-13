import GIF from 'gif.js';

/**
 * Generates an animated GIF from a conversation thread.
 * @param {Array} conversation - The array of turn objects.
 * @param {Function} onProgress - Callback for progress (0-1).
 * @returns {Promise<Blob>} - Resolves with the GIF blob.
 */
export const generateGif = (conversation, onProgress) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Filter turns that have images
      const imageTurns = conversation.filter(turn => turn.image);

      if (imageTurns.length === 0) {
        reject(new Error("No images to generate GIF from."));
        return;
      }

      // Initialize GIF encoder
      const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: '/gif.worker.js', // Assumes copied to public/
        width: 512, // Default, will be adjusted to first image
        height: 512
      });

      // Load all images first to get dimensions and data
      const loadedImages = await Promise.all(imageTurns.map(async (turn) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        return new Promise((res, rej) => {
          img.onload = () => res(img);
          img.onerror = (e) => rej(e);
          img.src = turn.image;
        });
      }));

      // Use dimensions of the first image
      const firstImg = loadedImages[0];
      const width = firstImg.naturalWidth || 512;
      const height = firstImg.naturalHeight || 512;

      gif.options.width = width;
      gif.options.height = height;

      // Add frames
      loadedImages.forEach((img) => {
        // Draw to canvas to ensure consistent size if needed (optional, but good practice)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw image cover/contain style
        // For now, simple drawImage (stretch if aspect ratio differs, or crop?)
        // Let's assume consistent aspect ratio from generation, or just draw center.
        ctx.drawImage(img, 0, 0, width, height);
        
        // Add text overlay? (Optional - maybe add turn number?)
        // ctx.font = '20px sans-serif';
        // ctx.fillStyle = 'white';
        // ctx.fillText(`Turn ${index}`, 10, 30);

        gif.addFrame(canvas, { delay: 1500 }); // 1.5s per frame
      });

      gif.on('progress', (p) => {
        if (onProgress) onProgress(p);
      });

      gif.on('finished', (blob) => {
        resolve(blob);
      });

      gif.render();

    } catch (error) {
      reject(error);
    }
  });
};


