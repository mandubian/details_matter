// Utility to compress images to WebP for efficient storage
export const compressImage = (dataUrl, maxWidth = 1280, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to WebP
      const compressedDataUrl = canvas.toDataURL('image/webp', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = (err) => reject(err);
  });
};

// Helper to process an entire conversation and compress all images
export const compressConversation = async (conversation) => {
  const compressed = await Promise.all(conversation.map(async (turn) => {
    const newTurn = { ...turn };
    if (newTurn.image) {
      try {
        newTurn.image = await compressImage(newTurn.image);
      } catch (e) {
        console.warn('Failed to compress image for turn', turn.id, e);
      }
    }
    return newTurn;
  }));
  return compressed;
};






