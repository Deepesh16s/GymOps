// Single source of truth for the safe, minimal user representation shown to
// other users — never email, health data, or private account flags. Shared
// by userController and conversationController so both surfaces can never
// drift out of sync on what counts as "public."
function toPublicUser(user) {
  return {
    username: user.username,
    name: user.name,
    picture: user.picture || "",
  };
}

module.exports = { toPublicUser };
