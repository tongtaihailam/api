const dressing = require("@common/dressing");
const responses = require("@common/responses");
const logger = require("@common/logger");
const discounts = require("@config/discounts");
const Currencies = require("@constants/Currencies");
const DressOwnerTypes = require("@constants/DressOwnerTypes");
const VipLevels = require("@constants/VipLevels");
const DressOptions = require("@models/DressOptions");
const Page = require("@models/Page");
const User = require("@models/User");
const Vip = require("@models/Vip");
const payServiceBase = require("@pay-service/base");
const decorationServiceBase = require("@decoration-service/base");

async function getDressList(userId, categoryId, currencyType, pageNo, pageSize) {
    const userInfo = await User.fromUserId(userId);
    const ownedDresses = await decorationServiceBase.getOwnedDresses(userId);
    
    const dressesData = dressing.getDresses(new DressOptions({
        categoryId: categoryId, 
        currency: currencyType,
        sex: userInfo.sex,
        hideClanDresses: true, 
        hideFreeDresses: true,
        ownerFilter: ownedDresses,
        ownerType: DressOwnerTypes.TAG_ITEM
    }));

    const data = new Page(dressesData, dressesData.length, pageNo, pageSize);
    return responses.success(data);
}

async function buyDresses(userId, decorationIds) {
    const vip = await Vip.fromUserId(userId);

    let diamondsNeeded = 0;
    let goldNeeded = 0;

    const purchasedDresses = [];
    const purchaseResults = {};

    for (var i = 0; i < decorationIds.length; i++) {
        const dressInfo = dressing.getDressInfo(decorationIds[i]);
        if (dressInfo == null) {
            purchaseResults[decorationIds[i]] = false;
            continue;
        }

        let hasEnoughCurrency = await payServiceBase.hasEnoughCurrency(userId, dressInfo.currency, dressInfo.price);
        if (!hasEnoughCurrency) {
            switch (dressInfo.currency) {
                case Currencies.GOLD:
                    goldNeeded += dressInfo.price;
                    break;
                case Currencies.DIAMOND:
                    diamondsNeeded += dressInfo.price;
                    break;
            }

            purchaseResults[dressInfo.id] = false;
            continue;
        }

        var discount = vip.getLevel() == VipLevels.VIP_PLUS ? discounts.vipShopDiscount : (vip.getLevel() == VipLevels.MVP ? discounts.mvpShopDiscount : 0);
        var actualPrice = dressInfo.price;
        if (discount > 0) {
            actualPrice = actualPrice * (100 - discount) / 100;
        }

        const { hasFailed } = await payServiceBase.removeCurrency(userId, dressInfo.currency, actualPrice, 3);
        purchaseResults[dressInfo.id] = !hasFailed;

        if (!hasFailed) {
            purchasedDresses.push(dressInfo.id);
        }
    }

    // TODO: Proceed to payment only if the user has enough of each currency to buy all items
    decorationServiceBase.addDresses(userId, purchasedDresses);
    
    if (diamondsNeeded > 0 || goldNeeded > 0) {
        return responses.notEnoughWealth({
            decorationPurchaseStatus: purchaseResults,
            diamondsNeed: diamondsNeeded,
            golds: goldNeeded,
        });
    }

    return responses.success({
        decorationPurchaseStatus: purchaseResults
    });
}

async function buyGameProp(userId, gameId, propId) {
    logger.warn("BuyGameProp: Implementation needed");
    return responses.innerError();
}

async function buyGame(userId, gameId) {
    logger.warn("BuyGame: Implementation needed");
    return responses.innerError();
}

async function getPagedDressList(userId, categoryId, currencyType, pageNo, pageSize) {
    const userInfo = await User.fromUserId(userId);
    const ownedDresses = await decorationServiceBase.getOwnedDresses();

    const dressesData = dressing.getDresses(new DressOptions({
        categoryId: categoryId, 
        currency: currencyType,
        sex: userInfo.sex,
        hideClanDresses: true, 
        hideFreeDresses: true,
        ownerFilter: ownedDresses,
        ownerType: DressOwnerTypes.TAG_ITEM
    }));

    return responses.success(new Page(pageNo, pageSize, dressesData));
}

module.exports = {
    getDressList: getDressList,
    buyDresses: buyDresses,
    buyGameProp: buyGameProp,
    buyGame: buyGame,
    getPagedDressList: getPagedDressList
}