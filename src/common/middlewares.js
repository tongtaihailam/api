const webtoken = require("@common/webtoken");

const Account = require("@models/Account");
const responses = require("@common/responses");
const User = require("@models/User");

async function userAuthentication(request) {
    request.getUserId = () => {
        return parseInt(request.headers["userid"]);
    };

    if (request.headers["userid"] == undefined || request.headers["access-token"] == undefined) {
        return { hasSucceeded: false, response: responses.requiresUserAuthParams() };
    }
    
    if (!request.getUserId()) {
        return { hasSucceeded: false, response: responses.authFailed() };
    }

    const account = await Account.fromUserId(request.headers["userid"]);
    const { isValid } = webtoken.verify(request.headers["access-token"], account.getAccessToken());
    
    if (!isValid) {
        return { hasSucceeded: false, response: responses.authFailed() };
    }

    return { hasSucceeded: true };
}

async function checkForUserProfile(request) {
    const isUserExists = await User.exists(request.getUserId());
    if (!isUserExists) {
        return { hasProfile: false, response: responses.profileNotExists()  }
    }
    
    return { hasProfile: true };
}

module.exports = {
    userAuthentication: userAuthentication,
    checkForUserProfile: checkForUserProfile
}