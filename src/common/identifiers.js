const mariadb = require("@common/mariadb");

module.exports.getNextUserId = async () => {
  const maxUserId = await mariadb.findFirst("SELECT MAX(userId) FROM account;", "MAX(userId)", 0);
  return Number(maxUserId) + 16;
}

module.exports.getNextClanId = async () => {
  const maxUserId = await mariadb.findFirst("SELECT MAX(clanId) FROM clan;", "MAX(clanId)", 0);
  return Number(maxUserId) + 4;
}