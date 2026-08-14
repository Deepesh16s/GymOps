import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import "./AvatarCropModal.css";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = src;
  });
}

async function getCroppedBlob(imageSrc, cropPixels) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

function AvatarCropModal({ open, imageFile, saving, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const imageUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageFile]);

  useModalEscapeAndFocus(open, onCancel);

  const handleCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageUrl) return;
    const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
    onConfirm(blob);
  };

  if (!open || !imageUrl) return null;

  return (
    <div className="avatar-crop-overlay">
      <div className="avatar-crop-card" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
        <h2 id="avatar-crop-title" className="avatar-crop-title">
          Reframe your photo
        </h2>

        <div className="avatar-crop-stage">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="avatar-crop-zoom-row">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="avatar-crop-zoom-slider"
          />
        </div>

        <div className="avatar-crop-actions">
          <button type="button" className="avatar-crop-btn avatar-crop-btn--cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="avatar-crop-btn avatar-crop-btn--confirm"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? "Uploading..." : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AvatarCropModal;
