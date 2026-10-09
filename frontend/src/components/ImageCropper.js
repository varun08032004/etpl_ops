import { useEffect, useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function ImageCropper({ src, onCrop, onCancel, aspect = 3/4 }) {
  const [crop, setCrop] = useState({ unit: '%', width: 100, aspect });
  const imgRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setCrop({ unit: '%', width: 100, aspect });
    setImageLoaded(false);
  }, [src]);

  const handleImageLoad = () => setImageLoaded(true);

  const checkImageLoaded = () => {
    if (imgRef.current && imgRef.current.complete) {
      setImageLoaded(true);
    }
  };

  useEffect(() => {
    checkImageLoaded();
    const interval = setInterval(checkImageLoaded, 100);
    return () => clearInterval(interval);
  }, [src]);

  const completeCrop = () => {
    if (!imgRef.current) return;
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    const pixelCrop = {
      x: crop.x * scaleX,
      y: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY,
    };
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      imgRef.current,
      pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
      0, 0, pixelCrop.width, pixelCrop.height
    );
    canvas.toBlob((blob) => {
      onCrop(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={{ maxWidth: '100%', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ position: 'relative', width: '100%', maxHeight: '50vh' }}>
        <ReactCrop
          src={src}
          crop={crop}
          onChange={setCrop}
          aspect={aspect}
          minWidth={50}
          minHeight={50}
          keepSelection
          disableAutomaticStylesInjection
          onImageLoaded={handleImageLoad}
        >
          <img ref={imgRef} src={src} alt="Crop preview" style={{ maxWidth: '100%', maxHeight: '50vh', display: 'block' }} />
        </ReactCrop>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: 'white',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={completeCrop}
          disabled={!imageLoaded}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            background: '#22C55E',
            color: 'white',
            cursor: imageLoaded ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 600,
            opacity: imageLoaded ? 1 : 0.6,
          }}
        >
          Crop & Use
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
        Drag corners to resize, drag center to move. Aspect ratio locked to 3:4 (ID card standard).
      </p>
    </div>
  );
}

export default ImageCropper;