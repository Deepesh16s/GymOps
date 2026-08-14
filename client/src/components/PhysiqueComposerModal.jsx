import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { ImagePlus } from "lucide-react";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import { createPhysiquePost } from "../services/physiqueService";
import "./PhysiqueComposerModal.css";

const CATEGORIES = [
  { value: "", label: "No category" },
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "side", label: "Side" },
  { value: "progress", label: "Progress" },
  { value: "other", label: "Other" },
];

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const CAPTION_MAX_LENGTH = 280;

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

function PhysiqueComposerModal({ open, accountIsPrivate, onCancel, onCreated }) {
  const [file, setFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("followers");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const reset = useCallback(() => {
    setFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCaption("");
    setCategory("");
    setVisibility("followers");
    setError("");
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    onCancel();
  }, [submitting, onCancel]);

  useModalEscapeAndFocus(open, handleCancel);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    if (!ALLOWED_MIME_TYPES.includes(selected.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("Image must be under 8MB.");
      return;
    }
    setError("");
    setFile(selected);
  };

  const handleCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSubmit = async () => {
    if (!croppedAreaPixels || !imageUrl) return;
    setSubmitting(true);
    setError("");
    try {
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
      const formData = new FormData();
      formData.append("image", blob, "physique.jpg");
      formData.append("caption", caption.trim());
      if (category) formData.append("category", category);
      formData.append("visibility", visibility);
      const res = await createPhysiquePost(formData);
      onCreated(res.data.post);
    } catch (err) {
      setError(err.response?.data?.message || "Could not share this update. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="physique-composer-overlay" onMouseDown={handleCancel}>
      <div
        className="physique-composer-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="physique-composer-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="physique-composer-title" className="physique-composer-title">
          Share a physique update
        </h2>

        {!file ? (
          <label className="physique-composer-dropzone">
            <ImagePlus size={28} />
            <span>Choose a photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} hidden />
          </label>
        ) : (
          <>
            <div className="physique-composer-stage">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={4 / 5}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="physique-composer-zoom-row">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="physique-composer-zoom-slider"
              />
            </div>

            <textarea
              className="physique-composer-caption"
              placeholder="Add a caption (optional)"
              value={caption}
              maxLength={CAPTION_MAX_LENGTH}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
            />

            <div className="physique-composer-row">
              <select
                className="physique-composer-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                className="physique-composer-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="followers">Followers only</option>
                <option value="public" disabled={accountIsPrivate}>
                  Public{accountIsPrivate ? " (account is private)" : ""}
                </option>
              </select>
            </div>
          </>
        )}

        {error && <p className="physique-composer-error">{error}</p>}

        <div className="physique-composer-actions">
          <button
            type="button"
            className="physique-composer-btn physique-composer-btn--cancel"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="physique-composer-btn physique-composer-btn--confirm"
            onClick={handleSubmit}
            disabled={submitting || !file || !croppedAreaPixels}
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PhysiqueComposerModal;
