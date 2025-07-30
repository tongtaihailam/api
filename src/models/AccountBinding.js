const mariadb = require("@common/mariadb");
const Model = require("@models/Model");

module.exports = class AccountBinding extends Model {
    constructor(userId) {
        super();

        this.userId = userId;
        this.connectId = "";
    }
    
    /** @returns {Promise<AccountBinding>} */
    static async fromUserId(userId) {
        const accountBinding = await mariadb.findFirst(`SELECT * FROM account_binding WHERE userId=${userId}`);
        if (accountBinding) return Model.fromJson(AccountBinding, accountBinding);

        return new AccountBinding(userId);
    }

    async save() {
        await mariadb.executeQuery(`INSERT INTO account_binding VALUES ${super.getSqlCreate()}`);
    }

    async delete() {
        await mariadb.executeQuery(`DELETE FROM account_binding WHERE userId=${this.userId}`);
    }

    response() {
        return { connectId: this.connectId }
    }

    setUserId(userId) {
        this.userId = userId;
    }

    getUserId() {
        return this.userId;
    }

    setConnectId(connectId) {
        this.connectId = connectId;
    }

    getConnectId() {
        return this.connectId;
    }
}
