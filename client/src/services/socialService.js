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
