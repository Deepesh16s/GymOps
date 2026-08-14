import { useEffect, useState } from "react";

function Avatar({ src, name, imgClassName }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return <img src={src} alt="" className={imgClassName} onError={() => setFailed(true)} />;
  }

  return name?.charAt(0).toUpperCase() || "?";
}

export default Avatar;
