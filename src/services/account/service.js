const bcrypt = require("bcrypt");
const responses = require("@common/responses");
const identifiers = require("@common/identifiers");
const webtoken = require("@common/webtoken");
const config = require("@config/auth");
const Account = require("@models/Account");
const User = require("@models/User");

async function appAuthToken(userId) {
    return responses.success();
}

async function appRenew() {
    const userId = await identifiers.getNextUserId();
    const tokenObject = webtoken.create({ userId: userId });
    
    const account = new Account(userId);
    account.setAccessToken(tokenObject.dbToken);
    account.setCreationTime(Date.now());
    await account.create();
    
    // The database contains the database token, we can now overwrite the access token to what will be sent to the client
    account.setAccessToken(tokenObject.userToken);

    return responses.success({
        userId: account.getUserId(),
        accessToken: account.getAccessToken()
    });
}

async function appSetPassword(userId, password) {
    const account = await Account.fromUserId(userId);
    if (account.getPassword()) {
        return responses.passwordAlreadySet();
    }

    const cryptoPassword = await bcrypt.hash(password, config.saltRounds);
    account.setPassword(cryptoPassword);
    await account.save();

    return responses.success();
}

async function appLogin(userId, password) {
    const account = await Account.fromUserId(userId);
    if (!account) {
        return responses.userNotExists();
    }

    const isPasswordValid = await bcrypt.compare(password, account.getPassword());
    if (!isPasswordValid) {
        return responses.invalidPassword();
    }

    const tokenObject = webtoken.create({
        userId: account.userId
    });

    account.setAccessToken(tokenObject.dbToken);
    account.setLoginTime(Date.now());
    await account.save();
    
    // The database contains the database token, we can now overwrite the access token to what will be sent to the client
    account.setAccessToken(tokenObject.userToken);

    const isProfileExists = await User.exists(account.getUserId());
    if (!isProfileExists) {
        return responses.profileNotExists(account.response());
    }

    return responses.success(account.response());
}

async function modifyPassword(userId, currentPassword, newPassword) {
    const account = await Account.fromUserId(userId);
    
    const isPasswordValid = await bcrypt.compare(currentPassword, account.getPassword());
    if (!isPasswordValid) {
        return responses.invalidPassword();
    }

    const cryptoPassword = await bcrypt.hash(newPassword, config.saltRounds);
    account.setPassword(cryptoPassword);
    await account.save();
    
    return responses.success();
}

module.exports = {
    appAuthToken: appAuthToken,
    appLogin: appLogin,
    appRenew: appRenew,
    appSetPassword: appSetPassword,
    modifyPassword: modifyPassword
}