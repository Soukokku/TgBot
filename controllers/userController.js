const db = require('../models');

exports.addUser = async (telegramId, userInfo) => {
    try {
        let user = await db.User.findOne({ where: { telegram_id: telegramId } });
        if (!user) {
            user = await db.User.create({
                telegram_id: telegramId,
                username: userInfo.username,
                name: userInfo.first_name + ' ' + (userInfo.last_name || ''),
                role: 'student'
            });
        }
        return user;
    } catch (error) {
        console.error('Ошибка при добавлении пользователя:', error);
    }
};

exports.assignCurator = async (chatId, username, groupId, bot) => {
    try {
        if (username.startsWith('@')) {
            username = username.substring(1);
        }

        const user = await db.User.findOne({ where: { username: username } });
        const group = await db.Group.findByPk(groupId);

        if (!user) {
            bot.sendMessage(chatId, `Пользователь с username @${username} не найден.`);
            return;
        }

        if (!group) {
            bot.sendMessage(chatId, `Группа с ID ${groupId} не найдена.`);
            return;
        }

        await user.update({ group_id: groupId, role: 'curator' });
        bot.sendMessage(chatId, `Пользователь @${user.username} назначен куратором группы "${group.name}".`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при назначении куратора.');
        console.error(error);
    }
};

exports.removeCuratorRole = async (chatId, username, bot) => {
    try {
        if (username.startsWith('@')) {
            username = username.substring(1);
        }

        const user = await db.User.findOne({ where: { username: username } });

        if (!user) {
            bot.sendMessage(chatId, `Пользователь с username @${username} не найден.`);
            return;
        }

        if (user.role !== 'curator') {
            bot.sendMessage(chatId, `Пользователь с username @${username} не является куратором.`);
            return;
        }

        await user.update({ role: 'student', group_id: null });
        bot.sendMessage(chatId, `Роль пользователя @${user.username} изменена на 'студент'.`);
    } catch (error) {
        bot.sendMessage(chatId, 'Произошла ошибка при удалении куратора.');
        console.error(error);
    }
};
