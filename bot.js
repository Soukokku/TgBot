const TelegramBot = require('node-telegram-bot-api');
const token = '7461792381:AAEIKFHDNLwC17s_3bro-oHCT2JCJ1YP-FE';
const bot = new TelegramBot(token, { polling: true });
const moment = require('moment');

const groupController = require('./controllers/groupController');
const taskController = require('./controllers/taskController');
const userController = require('./controllers/userController');
const db = require('./models');

const userStates = {};

// Отправка начального меню
const sendStartMenu = async (chatId) => {
    const buttons = [
        [{ text: 'Добавить группу', callback_data: 'add_group' }],
        [{ text: 'Группы, что ожидают добавления', callback_data: 'pending_groups' }],
        [{ text: 'Выбрать группу', callback_data: 'select_active_group_0' }]
    ];

    bot.sendMessage(chatId, 'Привет! Какая группа вам нужна?', {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
    userStates[chatId].previousMenu = sendStartMenu;
}

// Отправка меню группы
const sendGroupMenu = async (chatId, user) => {
    if (user && ( user.role === 'admin' || user.role === 'admin'))
    {
        const group = await db.Group.findByPk(user.group_id);
        bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Заявки на добавление задач', callback_data: 'getPendingTasks'}],
                    [{text: 'Задачи', callback_data: 'task_menu'}],
                    [{text: 'Добавить задачу', callback_data: 'add_task_menu'}],
                    [{text: 'Назад', callback_data: 'back_to_start'}]
                ]
            }
        });
        userStates[chatId].previousMenu = sendGroupMenu;
    }
    else
    {
        const group = await db.Group.findByPk(user.group_id);
        bot.sendMessage(chatId, `Вы выбрали группу "${group.name}"`, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Задачи', callback_data: 'task_menu'}],
                    [{text: 'Добавить задачу', callback_data: 'add_task_menu'}],
                    [{text: 'Назад', callback_data: 'back_to_start'}]
                ]
            }
        });
        userStates[chatId].previousMenu = sendGroupMenu;
    }
}

// Отправка меню добавления задачи
const sendAddTaskMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Какую задачу вы хотите добавить?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Для себя', callback_data: 'add_task_personal' }],
                [{ text: 'Для группы', callback_data: 'add_task_group' }],
                [{ text: 'Назад', callback_data: 'back_to_group' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendAddTaskMenu;
}

// Отправка меню задач
const sendTaskMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Какие задачи вы бы хотели просмотреть?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Мои задачи', callback_data: 'my_tasks' }],
                [{ text: 'Задачи группы', callback_data: 'group_tasks' }],
                [{ text: 'Назад', callback_data: 'back_to_group' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendTaskMenu;
}

// Отправка меню администратора
const sendAdminMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Выберите действие администратора:', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Назначить куратора', callback_data: 'assign_curator' }],
                [{ text: 'Активировать группу', callback_data: 'add_group_admin' }],
                [{ text: 'Удалить группу', callback_data: 'delete_group' }],
                [{ text: 'Удалить куратора', callback_data: 'remove_curator' }],
                [{ text: 'Назад', callback_data: 'back_to_start' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendAdminMenu;
}

// Отправка меню запросов задач
const sendTaskRequestMenu = async (chatId) => {
    bot.sendMessage(chatId, 'Заявка...', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Добавить', callback_data: 'approve_task' }],
                [{ text: 'Отклонить', callback_data: 'reject_task' }],
                [{ text: 'Назад', callback_data: 'back_to_group' }]
            ]
        }
    });
    userStates[chatId].previousMenu = sendTaskRequestMenu;
}

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    userStates[chatId] = {};

    await userController.addUser(telegramId, msg.from);

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.group_id !== null) {
        await sendGroupMenu(chatId, user);
    } else {
        await sendStartMenu(chatId);
    }
});

bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;

    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (user && user.role === 'admin') {
        userStates[chatId] = { role: 'admin' };
        await sendAdminMenu(chatId);
    } else {
        bot.sendMessage(chatId, 'Ошибка доступа. Вы не администратор.');
    }
});
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (!userStates[chatId]) {
        userStates[chatId] = {};
    }

    await bot.answerCallbackQuery(query.id);

    const user = await db.User.findOne({ where: { telegram_id: query.from.id } });

    if (!user) {
        bot.sendMessage(chatId, 'Пользователь не найден.');
        return;
    }

    if (data.startsWith('select_active_group_')) {
        const page = parseInt(data.split('_').pop());
        await groupController.showActiveGroups(chatId, bot, page);
        return;
    }

    if (data.startsWith('choose_group_')) {
        const groupId = parseInt(data.split('_').pop());
        await db.User.update({ group_id: groupId }, { where: { telegram_id: query.from.id } });
        const updatedUser = await db.User.findOne({ where: { telegram_id: query.from.id } });
        await sendGroupMenu(chatId, updatedUser);
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId });
        return;
    }

    switch (data) {
        case 'add_group':
            bot.sendMessage(chatId, 'Введите имя группы для добавления:');
            userStates[chatId].state = 'add_group';
            break;
        case 'pending_groups':
            await groupController.getPendingGroups(chatId, bot);
            await sendStartMenu(chatId);
            break;
        case 'add_task_menu':
            await sendAddTaskMenu(chatId);
            break;
        case 'task_menu':
            await sendTaskMenu(chatId);
            break;
        case 'back_to_start':
            await db.User.update({ group_id: null }, { where: { telegram_id: query.from.id } });
            await sendStartMenu(chatId);
            break;
        case 'back_to_group':
            await sendGroupMenu(chatId, user);
            break;
        case 'add_task_personal':
            bot.sendMessage(chatId, 'Введите название задачи:');
            userStates[chatId] = { state: 'add_task_personal_title', userId: user.id };
            break;
        case 'add_task_group':
            bot.sendMessage(chatId, 'Введите название задачи:');
            userStates[chatId] = { state: 'add_task_group_title', userId: user.id };
            break;
        case 'my_tasks':
            await taskController.getPersonalTasks(chatId, user.id, bot);
            break;
        case 'group_tasks':
            await taskController.getGroupTasks(chatId, user.id, bot);
            break;
        case 'approve_task':
            // Логика обработки утверждения задачи
            await sendTaskRequestMenu(chatId);
            break;
        case 'reject_task':
            // Логика обработки отклонения задачи
            await sendTaskRequestMenu(chatId);
            break;
        case 'assign_curator':
            bot.sendMessage(chatId, 'Введите username пользователя для назначения куратором:');
            userStates[chatId].state = 'assign_curator_username';
            break;
        case 'add_group_admin':
            bot.sendMessage(chatId, 'Введите ID группы для активации:');
            userStates[chatId].state = 'activate_group_id';
            break;
        case 'delete_group':
            bot.sendMessage(chatId, 'Введите имя группы для удаления:');
            userStates[chatId].state = 'delete_group_name';
            break;
        case 'remove_curator':
            bot.sendMessage(chatId, 'Введите username пользователя для удаления из кураторов:');
            userStates[chatId].state = 'remove_curator_username';
            break;
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userStates[chatId]) {
        const state = userStates[chatId].state;
        const userId = userStates[chatId].userId;

        switch (state) {
            case 'add_group':
                await groupController.createGroup(chatId, text, bot);
                userStates[chatId].state = null;
                await sendStartMenu(chatId);
                break;
            case 'add_task_personal_title':
                userStates[chatId].taskTitle = text;
                bot.sendMessage(chatId, 'Введите описание задачи:');
                userStates[chatId].state = 'add_task_personal_description';
                break;
            case 'add_task_personal_description':
                userStates[chatId].taskDescription = text;
                bot.sendMessage(chatId, 'Введите дедлайн задачи (YYYY-MM-DD):');
                userStates[chatId].state = 'add_task_personal_deadline';
                break;
            case 'add_task_personal_deadline':
                if (isValidDate(text)) {
                    const deadline = moment(text);
                    if (deadline.isBefore(moment(), 'day')) {
                        bot.sendMessage(chatId, 'Дата не может быть в прошлом. Пожалуйста, введите корректную дату:');
                    } else {
                        userStates[chatId].taskDeadline = text;
                        await taskController.addPersonalTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, userStates[chatId].taskDeadline, bot);
                        userStates[chatId] = {};
                    }
                } else {
                    bot.sendMessage(chatId, 'Некорректная дата. Пожалуйста, введите дату в формате YYYY-MM-DD:');
                }
                break;
            case 'add_task_group_title':
                userStates[chatId].taskTitle = text;
                bot.sendMessage(chatId, 'Введите описание задачи:');
                userStates[chatId].state = 'add_task_group_description';
                break;
            case 'add_task_group_description':
                userStates[chatId].taskDescription = text;
                bot.sendMessage(chatId, 'Введите дедлайн задачи (YYYY-MM-DD):');
                userStates[chatId].state = 'add_task_group_deadline';
                break;
            case 'add_task_group_deadline':
                if (isValidDate(text)) {
                    const deadline = moment(text);
                    if (deadline.isBefore(moment(), 'day')) {
                        bot.sendMessage(chatId, 'Дата не может быть в прошлом. Пожалуйста, введите корректную дату:');
                    } else {
                        userStates[chatId].taskDeadline = text;
                        await taskController.addGroupTask(chatId, userId, userStates[chatId].taskTitle, userStates[chatId].taskDescription, userStates[chatId].taskDeadline, bot);
                        userStates[chatId] = {};
                    }
                } else {
                    bot.sendMessage(chatId, 'Некорректная дата. Пожалуйста, введите дату в формате YYYY-MM-DD:');
                }
                break;
            case 'assign_curator_username':
                const group = await db.User.findOne({ where: { telegram_id: chatId } }).then(user => user.group_id);
                if (!group) {
                    bot.sendMessage(chatId, 'Вы не состоите в группе.');
                    break;
                }
                await userController.assignCurator(chatId, text, group, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            case 'activate_group_id':
                const groupId = parseInt(text);
                await groupController.activateGroup(chatId, groupId, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            case 'delete_group_name':
                await groupController.deleteGroup(chatId, text, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            case 'remove_curator_username':
                await userController.removeCuratorRole(chatId, text, bot);
                userStates[chatId].state = null;
                await sendAdminMenu(chatId);
                break;
            // Добавьте другие case для обработки состояния
        }
    }
});

const isValidDate = (dateString) => {
    return moment(dateString, 'YYYY-MM-DD', true).isValid();
}
