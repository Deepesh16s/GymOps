function toPublicUser(user) {
  return {
    username: user.username,
    name: user.name,
    picture: user.picture || "",
  };
}

module.exports = { toPublicUser };
