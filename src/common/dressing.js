const multer = require("@common/multer");
const constants = require("@common/constants");
const logger = require("@common/logger");

const config = require("@config/host");

const dressingTypes = {
    "2": "hair",
    "3": "glasses",
    "4": "face",
    "5": "idle",
    "6": "skin",
    "7": "background",
    "8": "tops",
    "9": "pants",
    "10": "shoes",
    "11": "hat",
    "13": "scarf",
    "14": "wing",
    "15": "crown"
}

const dressesCategory = {
    "8":  1,
    "9":  1,
    "10": 1,
    "2":  2,
    "11": 3,
    "13": 3,
    "14": 3,
    "15": 3,
    "3":  3,
    "4":  4,
    "5":  5,
    "6":  6,
    "7":  7
}

const dressesGameType = {
    "2": "custom_hair",
    "3": "custom_glasses",
    "4": "custom_face",
    "5": "animation_idle",
    "6": "skin_color",
    "8": "clothes_tops",
    "9": "clothes_pants",
    "10": "custom_shoes",
    "11": "custom_hat",
    "13": "custom_scarf",
    "14": "custom_wing",
    "15": "custom_crown"
}

const decorationCategories = {};

function init() {
    for (const typeId of Object.keys(dressesCategory)) {
        const categoryId = dressesCategory[typeId];
        const response = multer.getFile(`${constants.DECORATION_PATH}/${dressingTypes[typeId]}.json`);
        if (response.status != 200) {
            logger.error(`DRESSING ERROR: FAILED AT OBJECT '${dressingTypes[typeId]}'`);
            break;
        }

        decorationCategories[categoryId] ??= [];

        const data = JSON.parse(response.content);
        for (var j = 0; j < data.length; j++) {
             data[j].iconUrl = data[j].iconUrl.replace("{base}", `${config.baseHost}:${config.apiPort}/database/files/icons`);
        }

        decorationCategories[categoryId] = decorationCategories[categoryId].concat(data);
    }
}

function getDresses(options) {
    if (decorationCategories[options.categoryId] == undefined) {
        return [];
    }

    return decorationCategories[options.categoryId].filter((item) => {
        item.status = 0;
        
        if (options.usingFilter != undefined && options.usingFilter.includes(item.id)) {
            item.status = 1;
            return true;
        }
        
        if (options.ownerFilter != undefined && options.ownerType == 1) {
            return options.ownerFilter.includes(item.id);
        }

        if (options.hideClanDresses && item.clanLevel > 0) {
            return false;
        }

        if (options.hideFreeDresses && item.currency == 0) {
            return false;
        }

        var sexValidator = item.sex == options.sex || item.sex == 0;
        var currencyValidator = item.currency == options.currency || options.currency == 0;

        if (options.ownerFilter != undefined && options.ownerType == 2 && options.ownerFilter.includes(item.id)) {
            item.hasPurchase = 1;
        }

        return (sexValidator && currencyValidator);
    });
}

function getDressInfo(decorationId) {
    if (decorationId == undefined) {
        return null;
    }
    
    decorationId = decorationId.toString();
    if (decorationId.length <= 5) {
        return null;
    }
    
    let dressTypeId = decorationId.substring(0, decorationId.length - 5);
    let categoryId = dressesCategory[dressTypeId];
    return decorationCategories[categoryId].find(item => item.id.toString() == decorationId);
}

function getGameDresses(decorationIds) {
    const skin = {};
    for (var i = 0; i < decorationIds.length; i++) {
        const dressInfo = getDressInfo(decorationIds[i]);
        if (dressesGameType[dressInfo.typeId] == undefined) {
            continue;
        }

        if (dressInfo.typeId == 6) {
            skin["skin_color"] = dressInfo.resourceId;
        } else {
            skin[dressesGameType[dressInfo.typeId]] = dressInfo.resourceId.split('.')[1];
        }
    }

    return skin;
}

module.exports = {
    init: init,
    getDresses: getDresses,
    getDressInfo: getDressInfo,
    getGameDresses: getGameDresses
}