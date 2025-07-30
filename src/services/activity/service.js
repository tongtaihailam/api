const constants = require("@common/constants");
const logger = require("@common/logger");
const redis = require("@common/redis");
const responses = require("@common/responses");
const luckyWheelConfig = require("@config/luckywheel");

async function getSignInActivity(userId) {
    logger.warn("GetSignInActivity: Implementation needed");
    return responses.innerError();
}

async function getSignInReward(userId) {
    logger.warn("GetSignInReward: Implementation needed");
    return responses.innerError();
}

async function getActivityList(userId) {
    logger.warn("GetActivityList: Implementation needed");
    return responses.innerError();
}

async function getActivityTaskList(userId, activityType) {
    logger.warn("GetActivityTaskList: Implementation needed");
    return responses.innerError();
}

async function getActivityFreeWheelStatus(userId) {
    const freeWheel = await redis.getKey(constants.CACHE_ACTIVITY_FREE_WHEEL, userId);
    return responses.success({ isFree: freeWheel == null ? 1 : 0 });
}

async function getActivityWheelInfo(userId, type) {
    if (type != "gold" && type != "diamond") {
        return responses.invalidType();
    }

    const activityInfo = { ...luckyWheelConfig[type] };
    activityInfo.activityDesc = luckyWheelConfig.activityDesc;

    const freeWheel = await redis.getKey(constants.CACHE_ACTIVITY_FREE_WHEEL, userId);
    activityInfo.isFree = (freeWheel == null && type != "diamond" ? 1 : 0);

    return responses.success(activityInfo);
}


async function playActivityWheel(userId, type, isMultiplePlay) {
    return responses.success({
        rewardId: 4,
        rewardType: "diamond",
        rewardName: "1",
        pic: "http://static.sandboxol.com/sandbox/activity/treasurebox/Bcubes.png",
        userLuckyValue: 0,
        isTransform: 0,
        luckyValue: 0,
        before: null,
        now: null
    });
}

async function getActivityWheelShopInfo(userId, type) {
    return responses.success({
        userBlock: 10,
        exchangeEndTime: "",
        tips: "",
        remainingTime: 9999,
        blockShopRewardInfoList: [
            {rewardId: 0, rewardName: "", rewardType: "", needBlock: 0, pic: "", exchangeUpperLimit: 0}
        ]
    });
}

module.exports = {
    getSignInActivity: getSignInActivity,
    getSignInReward: getSignInReward,
    getActivityList: getActivityList,
    getActivityTaskList: getActivityTaskList,
    getActivityFreeWheelStatus: getActivityFreeWheelStatus,
    getActivityWheelInfo: getActivityWheelInfo,
    getActivityWheelShopInfo: getActivityWheelShopInfo,
    playActivityWheel: playActivityWheel
}