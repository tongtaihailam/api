const constants = require("@common/constants");
const database = require("@common/database");
const logger = require("@common/logger");
const responses = require("@common/responses");
const nickNameConfig = require("@config/nickname");
const Localization = require("@models/Localization");
const User = require("@models/User");
const Vip = require("@models/Vip");

async function getConfigFile(configFile) {
    const config = database.getKey(constants.DB_APP_CONFIG_TABLE, configFile, true);
    return responses.success(config || {});
}

async function getUserInfo(userId) {
    const user = await User.fromUserId(userId);
    const vip = await Vip.fromUserId(userId);

    return responses.success({
        ...user.response(),
        ...vip.response()
    });
}

async function setUserInfo(userId, picUrl, birthday, details) {
    const user = await User.fromUserId(userId);

    // TODO: Check parameters validity

    if (picUrl != null) user.setProfilePic(picUrl);
    if (birthday != null) user.setBirthday(birthday);
    if (details != null) user.setDetails(details);
    await user.save();

    return responses.success(user);
}

async function createProfile(userId, nickName, sex) {
    const isUserExists = await User.exists(userId);
    if (isUserExists) {
        return responses.profileExists();
    }

    const user = new User(userId);

    // TODO: Check nickname validity
    // TODO: Check if nickname is already used

    if (!nickName || !sex) {
        return responses.missingRegisterParams();
    }

    if (sex != 1 && sex != 2) {
        return responses.invalidSex();
    }

    user.setNickname(nickName);
    user.setSex(sex);
    await user.create();

    const vip = new Vip(userId);
    await vip.create();

    const userLocale = new Localization(userId);
    // TODO: Add country code based on IP
    await userLocale.create(); 

    return responses.success({
        ...user.response(),
        ...vip.response()
    });
}

async function changeNickName(userId, newNickname) {
    const user = await User.fromUserId(userId);

    // TODO: Check nickname validity
    // TODO: Check if newNickname is the same as the old one 
    // TODO: Check if nickname is already used
    // TODO: Remove the configured amount and currency if isFreeNickname is false

    user.nickName = newNickname;
    await user.save();

    return responses.success(user);
}

async function isChangingNameFree(userId) {
    const user = await User.fromUserId(userId);

    return responses.success({
        currencyType: nickNameConfig.currencyType,
        quantity: nickNameConfig.quantity,
        free: user.getIsFreeNickname()
    });
}

async function setUserLanguage(userId, language) {
    const locale = await Localization.fromUserId(userId);

    // TODO: Check language validity

    locale.setLanguage(language);
    await locale.save();

    return responses.success();
}

async function getUserVipInfo(userId) {
    const vip = await Vip.fromUserId(userId);
    return responses.success(vip.response());
}

async function getDailyRewardInfo(userId) {
    logger.warn("GetDailyConfig: Implementation needed");
    return responses.innerError();
}

async function receiveDailyReward(userId) {
    logger.warn("GetDailyReward: Implementation needed");
    return responses.innerError();
}

async function getDailyTasksAdConfig(userId) {
    logger.warn("GetDailyTasksAdConfig: Implementation needed");
    return responses.success();
}

async function reportUser(userId) {
    logger.warn("ReportUser: Implementation needed");
    return responses.innerError();
}

async function getUserInfoReward(userId) {
    logger.warn("GetUserInfoReward: Implementation needed");
    return responses.innerError();
}

module.exports = {
    getConfigFile: getConfigFile,
    createProfile: createProfile,
    changeNickName: changeNickName,
    isChangingNameFree: isChangingNameFree,
    setUserInfo: setUserInfo,
    getUserInfo: getUserInfo,
    setUserLanguage: setUserLanguage,
    getUserVipInfo: getUserVipInfo,
    getDailyRewardInfo: getDailyRewardInfo,
    receiveDailyReward: receiveDailyReward,
    getDailyTasksAdConfig: getDailyTasksAdConfig,
    reportUser: reportUser,
    getUserInfoReward: getUserInfoReward
}