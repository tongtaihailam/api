const constants = require("@common/constants");
const database = require("@common/database");
const logger = require("@common/logger");
const responses = require("@common/responses");
const identifiers = require("@common/identifiers");
const clanConfig = require("@config/clan");
const ClanMessageTypes = require("@constants/ClanMessageTypes");
const RequestStatuses = require("@constants/RequestStatuses");
const ClanRoles = require("@constants/ClanRoles");
const Currencies = require("@constants/Currencies");
const ClanPromotionTypes = require("@constants/ClanPromotionTypes");
const Clan = require("@models/Clan");
const ClanMember = require("@models/ClanMember");
const ClanMessage = require("@models/ClanMessage");
const ClanNotice = require("@models/ClanNotice");
const Friend = require("@models/Friend");
const Page = require("@models/Page");
const User = require("@models/User");
const Wealth = require("@models/Wealth");
const payServiceBase = require("@pay-service/base");
const ClanDonation = require("@models/ClanDonation");
const Vip = require("@models/Vip");

async function getClanRecommendation() {
    logger.warn("GetClanRecommendation: Implementation needed");
    return responses.success([]);
}

async function getClanInfo(clanId) {
    const clan = await Clan.fromClanId(clanId);
    if (!clan) {
        return responses.clanNotExists();
    }

    const shownMembers = await clan.getMembers(true);
    return responses.success(clan.response(shownMembers));
}

async function updateClanInfo(userId, name, headPic, details, tags) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    clan.setName(name);
    clan.setProfilePic(headPic);
    clan.setDetails(details);
    clan.setTags(tags);
    clan.save();

    return responses.success(clan);
}

async function deleteClan(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.CHIEF) {
        return responses.notEnoughPermissions();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    const clanMembers = await clan.getMembers();
    for (let i = 0; i < clanMembers.length; i++) {
        clanMembers[i].delete(); // Good bye!
    }

    // The finale!
    await clan.delete();

    return responses.success();
}

async function createClan(userId, name, picUrl, details, tags) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (clanMember != null && clanMember.getClanId() != 0) {
        return responses.alreadyInClan();
    }

    // TODO: Check if the user has enough money (8000 Gold / 60 Bcubes)

    const clanId = await identifiers.getNextClanId();
    const clan = new Clan(clanId);

    clan.setName(name);
    clan.setProfilePic(picUrl);
    clan.setDetails(details);
    clan.setTags(tags);
    clan.setCreationTime(Date.now());

    clan.addMember(userId, ClanRoles.CHIEF);
    clan.create();

    return responses.success();
}

async function getClanMembers(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    const clanMembers = await clan.getMembers();

    return responses.success(clanMembers);
}

async function sendClanRequest(userId, clanId, message) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (clanMember != null && clanMember.getClanId() != 0) {
        return responses.alreadyInClan();
    }

    if (!Clan.exists(clanId)) {
        return responses.clanNotExists();
    }

    const user = await User.fromUserId(userId);
    const request = await ClanMessage.findFirst(userId, ClanMessageTypes.JOIN_REQUEST, RequestStatuses.PENDING);

    if (request.getMessageId() != null) {
        request.setMessage(message);
        request.setProfilePic(user.getProfilePic());
        request.setNickname(user.getNickname());
    } else {
        request.setUserId(userId);
        request.setClanId(clanId);
        request.setMessage(message);
        request.setProfilePic(user.getProfilePic());
        request.setNickname(user.getNickname());
        request.setType(ClanMessageTypes.JOIN_REQUEST);
        request.setCreationTime(Date.now());
    }

    await request.save();
    return responses.success();
}

async function setMemberRole(userId, memberId, type) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.CHIEF) {
        return responses.notEnoughPermissions();
    }

    if (userId == memberId) {
        return responses.cannotChangeOwnRole();
    }

    const targetMember = await ClanMember.fromUserId(memberId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    const clanLevelConfig = clanConfig.levels[clan.level];

    const elderCount = await clan.getElderCount();

    switch (type) {
        case ClanPromotionTypes.ELDER: {
            if (targetMember.role == ClanRoles.ELDER) {
                return responses.alreadyElder();
            }

            if (elderCount + 1 > clanLevelConfig.maxElders) {
                return responses.elderLimitReached();
            }

            targetMember.setRole(ClanRoles.ELDER);
            targetMember.save();
            
            const targetUser = await User.fromUserId(targetMember.getUserId());
            const message = new ClanMessage(targetMember.getUserId());

            message.setClanId(clan.getClanId());
            message.setType(ClanMessageTypes.ELDER_PROMOTION);
            message.setProfilePic(targetUser.getProfilePic());
            message.setNickname(targetUser.getNickname());
            message.setCreationTime(Date.now());
            await message.save();

            break;
        }
        case ClanPromotionTypes.MEMBER: {
            targetMember.setRole(ClanRoles.MEMBER);
            targetMember.save();

            const targetUser = await User.fromUserId(targetMember.getUserId());
            const message = new ClanMessage(targetMember.getUserId());

            message.setClanId(clan.getClanId());
            message.setType(ClanMessageTypes.RETROGRADED);
            message.setProfilePic(targetUser.getProfilePic());
            message.setNickname(targetUser.getNickname());
            message.setCreationTime(Date.now());
            await message.save();

            break;
        }
        case ClanPromotionTypes.CHIEF: {
            clanMember.setRole(ClanRoles.MEMBER);
            clanMember.save();

            targetMember.setRole(ClanRoles.CHIEF);
            targetMember.save();

            const targetUser = await User.fromUserId(targetMember.getUserId());
            const message = new ClanMessage(targetMember.getUserId());

            message.setClanId(clan.getClanId());
            message.setType(ClanMessageTypes.CHIEF_PROMOTION);
            message.setProfilePic(targetUser.getProfilePic());
            message.setNickname(targetUser.getNickname());
            message.setCreationTime(Date.now());
            await message.save();

            break;
        }
        default: {
            return responses.invalidType();
        }
    }

    return responses.success();
}

async function leaveClan(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role == ClanRoles.CHIEF) {
        return responses.cannotLeaveClan();
    }

    clanMember.delete();

    const user = await User.fromUserId(userId);
    const message = new ClanMessage(userId);

    message.setClanId(clanMember.getClanId());
    message.setType(ClanMessageTypes.MEMBER_LEFT);
    message.setProfilePic(user.getProfilePic());
    message.setNickname(user.getNickname());
    message.setCreationTime(Date.now());
    message.save();

    return responses.success();
}

async function getBaseClanInfo(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    return getClanInfo(clanMember.getClanId());
}

async function removeMember(userId, memberId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    const isRemoved = await clan.removeMember(memberId, ClanMessageTypes.MEMBER_REMOVED);

    if (!isRemoved) {
        return responses.notValidUser();
    }
    
    const memberUser = await User.fromUserId(memberId);
    const message = new ClanMessage(memberId);

    message.setClanId(clan.getClanId());
    message.setType(ClanMessageTypes.MEMBER_REMOVED);
    message.setProfilePic(memberUser.getProfilePic());
    message.setNickname(memberUser.getNickname());
    message.setCreationTime(Date.now());
    message.save();

    await clan.save();
    return responses.success();
}

async function getClanMessages(userId, pageNo, pageSize) {
    const clanMember = await ClanMember.fromUserId(userId);

    let filter = "";
    switch (clanMember.role) {
        case ClanRoles.MEMBER:
            filter = `clanId=${clanMember.getClanId()} AND (type=${ClanMessageTypes.ELDER_PROMOTION} OR type=${ClanMessageTypes.CHIEF_PROMOTION} OR type=${ClanMessageTypes.MEMBER_REMOVED} OR type=${ClanMessageTypes.MEMBER_LEFT} OR (type=${ClanMessageTypes.JOIN_INVITE} AND status=${RequestStatuses.ACCEPTED}))`;
            break;
        case ClanRoles.ELDER:
            filter = `clanId=${clanMember.getClanId()} AND (type=${ClanMessageTypes.JOIN_REQUEST} OR type=${ClanMessageTypes.ELDER_PROMOTION} OR type=${ClanMessageTypes.CHIEF_PROMOTION} OR type=${ClanMessageTypes.MEMBER_REMOVED} OR type=${ClanMessageTypes.MEMBER_LEFT})`;
            break;
        case ClanRoles.CHIEF:
            filter = `clanId=${clanMember.getClanId()} AND (type=${ClanMessageTypes.JOIN_REQUEST} OR type=${ClanMessageTypes.MEMBER_REMOVED} OR type=${ClanMessageTypes.MEMBER_LEFT})`;
            break;
        default: 
            filter = `userId=${userId} AND (type=${ClanMessageTypes.MEMBER_REMOVED} OR type=${ClanMessageTypes.JOIN_INVITE} OR type=${ClanMessageTypes.CLAN_DISSOLVED})`;
            break;
    }

    const messages = await ClanMessage.listFromFilter(filter, pageNo, pageSize);
    return responses.success(messages);
}

async function inviteFriends(userId, friends, message) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const user = await User.fromUserId(userId);
    const userFriendList = await Friend.listIdsFromUserId(userId);

    for (let friendId of friends) {
        if (!userFriendList.includes(friendId)) {
            continue;
        }

        const invite = await ClanMessage.findFirst(friendId, ClanMessageTypes.JOIN_INVITE, RequestStatuses.PENDING);
        if (invite.getMessageId() != null) {
            invite.setProfilePic(user.getProfilePic());
            invite.setNickname(user.getNickname());
            invite.setMessage(message);
        } else {
            invite.setClanId(clanMember.getClanId());
            invite.setType(ClanMessageTypes.JOIN_INVITE);
            invite.setStatus(RequestStatuses.PENDING);
            invite.setProfilePic(user.getProfilePic());
            invite.setNickname(user.getNickname());
            invite.setMessage(message);
            invite.setCreationTime(Date.now());
        }

        invite.save();
    }

    return responses.success();
}

async function acceptClanRequest(userId, targetUserId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const request = await ClanMessage.findFirst(targetUserId, ClanMessageTypes.JOIN_REQUEST, RequestStatuses.PENDING);
    if (!request.getMessageId()) {
        return responses.clanMessageNotFound();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    await clan.addMember(targetUserId, ClanRoles.MEMBER);
    await clan.save();

    request.setStatus(RequestStatuses.ACCEPTED);
    await request.save();

    // TODO: Update all invitations and requests related to the user as well  

    return responses.success();
}

async function rejectClanRequest(userId, targetUserId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const request = await ClanMessage.findFirst(targetUserId, ClanMessageTypes.JOIN_REQUEST, RequestStatuses.PENDING);
    if (!request.getMessageId()) {
        return responses.clanMessageNotFound();
    }

    request.setStatus(RequestStatuses.REFUSED);
    await request.save();

    return responses.success();
}

async function acceptClanInvitation(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (clanMember != null && clanMember.getClanId() != 0) {
        return responses.alreadyInClan();
    }

    const request = await ClanMessage.findFirst(userId, ClanMessageTypes.JOIN_INVITE, RequestStatuses.PENDING);
    if (!request.getMessageId()) {
        return responses.clanMessageNotFound();
    }

    const clan = await Clan.fromClanId(request.clanId);
    await clan.addMember(userId, ClanRoles.MEMBER);
    await clan.save();

    request.setStatus(RequestStatuses.ACCEPTED);
    await request.save();

    return responses.success();
}

async function rejectClanInvitation(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (clanMember != null && clanMember.getClanId() != 0) {
        return responses.alreadyInClan();
    }

    const request = await ClanMessage.findFirst(userId, ClanMessageTypes.JOIN_INVITE, RequestStatuses.PENDING);
    if (!request.getMessageId()) {
        return responses.clanMessageNotFound();
    }

    request.setStatus(RequestStatuses.REFUSED);
    await request.save();

    return responses.success();
}

async function getClanNotice(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    const notice = await ClanNotice.fromClanId(clanMember.getClanId());
    return responses.success(notice.response());
}

async function setClanNotice(userId, content) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const notice = await ClanNotice.fromClanId(clanMember.getClanId());
    notice.setContent(content);
    notice.save();

    return responses.success();
}

async function getClanDresses(userId, typeId, pageNo, pageSize) {
    logger.warn("GetClanDresses: Implementation needed");
    return responses.innerError();
}

async function getClanDressDetails(userId, decorationId) {
    logger.warn("GetClanDressDetails: Implementation needed");
    return responses.innerError();
}

async function purchaseClanDress(userId, decorationId) {
    logger.warn("PurchaseClanDress: Implementation needed");
    return responses.innerError();
}

async function searchClan(userId, clanName, pageNo, pageSize) {
    const clanMember = ClanMember.fromUserId(userId);
    const clanId = clanMember.getClanId() ?? 0;

    const isClanExists = !isNaN(clanName) && await Clan.exists(clanName);
    if (isClanExists) {
        const clan = await Clan.fromClanId(clanName);
        return responses.success(new Page(pageNo, pageSize, [clan]));
    }

    const results = await Clan.search(clanId, clanName, pageNo, pageSize);
    return responses.success(results);
}

async function getDonationInfo(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    const clanDonation = new ClanDonation(userId);
    clanDonation.setClanId(clanMember.getClanId());

    const clanDonationInfo = await clanDonation.getInfo();
    return responses.success(clanDonationInfo);
}

async function giveDonation(userId, currency, quantity) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    if (currency != Currencies.DIAMOND && currency != Currencies.GOLD) {
        return responses.invalidCurrency();
    }

    if (quantity <= 0) {
        return responses.invalidDonateQuantity();
    }

    const vip = await Vip.fromUserId(userId);

    const clan = await Clan.fromClanId(clanMember.getClanId());
    const clanLevelConfig = clanConfig.levels[clan.level];

    const clanDonation = new ClanDonation(userId);
    clanDonation.setClanId(clan.getClanId());

    const clanDonationInfo = await clanDonation.getInfo();

    switch (currency) {
        case Currencies.DIAMOND:
            if (clanDonationInfo.currentDiamond + quantity > clanDonationInfo.maxDiamond) {
                return responses.donationExceedsMax();
            }

            clanDonation.setAmount(clanDonationInfo.currentDiamond + quantity);
            clanDonation.setExpReward(quantity * clanLevelConfig.diamondExperienceRate * clanConfig.vipBoosts[vip.getLevel()].diamondExperienceRate);
            clanDonation.setClanGoldReward(quantity * clanLevelConfig.diamondCurrencyRate * clanConfig.vipBoosts[vip.getLevel()].diamondCurrencyRate);
            break;
        case Currencies.GOLD:
            if (clanDonationInfo.currentGold + quantity > clanDonationInfo.maxGold) {
                return responses.donationExceedsMax();
            }

            clanDonation.setAmount(clanDonationInfo.currentGold + quantity);
            clanDonation.setExpReward(quantity * clanLevelConfig.goldExperienceRate * clanConfig.vipBoosts[vip.getLevel()].goldExperienceRate);
            clanDonation.setClanGoldReward(quantity * clanLevelConfig.goldCurrencyRate * clanConfig.vipBoosts[vip.getLevel()].goldCurrencyRate);
            break;
    }

    if (!payServiceBase.hasEnoughCurrency(userId, currency, quantity)) {
        return responses.notEnoughWealth();
    }

    await payServiceBase.removeCurrency(userId, currency, quantity);
    await payServiceBase.addCurrency(userId, Currencies.CLAN_GOLD, clanDonation.getClanGoldReward());

    const user = await User.fromUserId(userId);

    clanDonation.setNickname(user.getNickname());
    clanDonation.setType(currency);
    clanDonation.setCreationTime(Date.now());
    await clanDonation.save();
    
    clanMember.addExperience(clanDonation.getExpReward());
    await clanMember.save();

    clan.addExperience(clanDonation.getExpReward());
    await clan.save();

    return responses.success({
        experienceGot: clanDonation.getExpReward(),
        tribeCurrencyGot: clanDonation.getClanGoldReward()
    });
}

async function getDonationHistory(userId, pageNo, pageSize) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.notInClan();
    }

    const clanDonationHistory = await ClanDonation.historyFromClanId(clanMember.getClanId(), pageNo, pageSize);
    return responses.success(clanDonationHistory);
}

async function getClanId(userId) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.success(0);
    }

    return responses.success(clanMember.getClanId());
}

async function getGlobalClanRank(type, pageNo, pageSize) {
    logger.warn("GetGlobalClanRank: Implementation needed");
    return responses.innerError();
}

async function getClanRank(userId, type) {
    logger.warn("GetClanRank: Implementation needed");
    return responses.innerError();
}

async function getClanWealth(userId) {
    const wealth = await Wealth.fromUserId(userId);
    return responses.success(wealth.clanGold);
}

async function getPersonalTasks(userId, type) {
    logger.warn("GetPersonalTasks: Implementation needed");
    return responses.innerError();
}

async function getClanTasks(userId, type) {
    logger.warn("GetClanTasks: Implementation needed");
    return responses.innerError();
}

async function getTaskReward(userId, taskId, type) {
    logger.warn("GetTaskReward: Implementation needed");
    return responses.innerError();
}

async function acceptTask(userId, taskId, type) {
    logger.warn("AcceptTask: Implementation needed");
    return responses.innerError();
}

async function setVerificationFree(userId, isFreeVerify) {
    const clanMember = await ClanMember.fromUserId(userId);
    if (!clanMember || !clanMember.getClanId()) {
        return responses.clanNotExists();
    }

    if (clanMember.role < ClanRoles.ELDER) {
        return responses.notEnoughPermissions();
    }

    const clan = await Clan.fromClanId(clanMember.getClanId());
    clan.setVerification(isFreeVerify);
    clan.save();

    return responses.success({ freeVerify: isFreeVerify });
}

module.exports = {
    getClanRecommendation: getClanRecommendation,
    getClanInfo: getClanInfo,
    updateClanInfo: updateClanInfo,
    deleteClan: deleteClan,
    createClan: createClan,
    getClanMembers: getClanMembers,
    sendClanRequest: sendClanRequest,
    setMemberRole: setMemberRole,
    leaveClan: leaveClan,
    getBaseClanInfo: getBaseClanInfo,
    removeMember: removeMember,
    getClanMessages: getClanMessages,
    inviteFriends: inviteFriends,
    acceptClanRequest: acceptClanRequest,
    rejectClanRequest: rejectClanRequest,
    acceptClanInvitation: acceptClanInvitation,
    rejectClanInvitation: rejectClanInvitation,
    getClanNotice: getClanNotice,
    setClanNotice: setClanNotice,
    getClanDresses: getClanDresses,
    getClanDressDetails: getClanDressDetails,
    purchaseClanDress: purchaseClanDress,
    searchClan: searchClan,
    getDonationInfo: getDonationInfo,
    giveDonation: giveDonation,
    getDonationHistory: getDonationHistory,
    getClanId: getClanId,
    getGlobalClanRank: getGlobalClanRank,
    getClanRank: getClanRank,
    getClanWealth: getClanWealth,
    getPersonalTasks: getPersonalTasks,
    getClanTasks: getClanTasks,
    getTaskReward: getTaskReward,
    acceptTask: acceptTask,
    setVerificationFree: setVerificationFree
}