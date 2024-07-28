const express = require('express');
const app = express();
const db = require('./models');
const bot = require('./bot'); 

db.sequelize.sync().then(() => {
    app.listen(3000, () => {
        console.log("Server started on port 3000");
    });
});