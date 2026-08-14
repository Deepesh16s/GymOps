import api from "./api";

export const submitReport = ({ targetType, targetId, reason, description }) =>
  api.post("/reports", { targetType, targetId, reason, description });
