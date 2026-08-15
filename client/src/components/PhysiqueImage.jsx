import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import "./PhysiqueImage.css";

function PhysiqueImage({ src, alt, className, loading }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`${className || ""} physique-image-fallback`.trim()} role="img" aria-label={alt || "Image unavailable"}>
        <ImageOff size={20} strokeWidth={1.6} />
      </div>
    );
  }

  return <img src={src} alt={alt || ""} className={className} loading={loading} onError={() => setFailed(true)} />;
}

export default PhysiqueImage;
