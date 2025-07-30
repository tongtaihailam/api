require("module-alias/register");

const app = require("express")();
require("./router")(app);

const database = require("@common/database");
const dressing = require("@common/dressing");
const mariadb = require("@common/mariadb");
const redis = require("@common/redis");

database.init();
dressing.init();
mariadb.init();
redis.init();

const logger = require("@common/logger");
const config = require("@config/host");

app.listen(config.apiPort, () => {
    logger.info(`API server started PORT=${config.apiPort}`);
});