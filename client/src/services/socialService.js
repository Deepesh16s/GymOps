import api from "./api";

export const searchUsers = (q) => api.get("/users/search", { params: { q } });

export const getPublicProfile = (username) => api.get(`/users/${username}`);

export const getFollowers = (username, page = 1) =>
  api.get(`/users/${username}/followers`, { params: { page } });

export const getFollowing = (username, page = 1) =>
  api.get(`/users/${username}/following`, { params: { page } });

export const followUser = (username) => api.post(`/users/${username}/follow`);

export const unfollowUser = (username) => api.delete(`/users/${username}/follow`);

export const blockUser = (username) => api.post(`/users/${username}/block`);

export const unblockUser = (username) => api.delete(`/users/${username}/block`);

export const getHeatmap = (username, year) =>
  api.get(`/users/${username}/heatmap`, { params: { year } });

export const getHeatmapDay = (username, date) => api.get(`/users/${username}/heatmap/${date}`);

export const getSessions = (username, page = 1) =>
  api.get(`/users/${username}/sessions`, { params: { page } });

export const getPRs = (username) => api.get(`/users/${username}/prs`);

export const getActivity = (username, page = 1) =>
  api.get(`/users/${username}/activity`, { params: { page } });

export const getFollowRequests = () => api.get("/users/follow-requests");

export const acceptFollowRequest = (username) =>
  api.post(`/users/${username}/accept-follow-request`);

export const declineFollowRequest = (username) =>
  api.post(`/users/${username}/decline-follow-request`);
